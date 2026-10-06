#!/usr/bin/env python3
"""Genere le dashboard Grafana a partir de spec-supervision.json."""
import json, os

SPEC = "/opt/sentinel-x/grafana/spec-supervision.json"
OUT  = "/opt/sentinel-x/grafana/provisioning/dashboards/sentinel-supervision.json"
DS   = "P951FEA4DE68E13C5"

def uid_s(texte):
    h = 0
    for c in texte: h = (h*31 + ord(c)) & 0xFFFFFFFF
    return str(h)

def ds():
    return {"type": "influxdb", "uid": DS}

def flux_base(m):
    if m.get("topics"):
        c = ",".join(f'r.topic == "{t}"' for t in m["topics"])
        return f'from(bucket: "sentinel") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == "{m["mesure"]}") |> filter(fn: (r) => {c})'
    cond = f'r._measurement == "{m["mesure"]}"'
    for k, v in (m.get("filtres") or {}).items():
        cond += f' and r.{k} == "{v}"'
    return f'from(bucket: "sentinel") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => {cond})'

def requete_champ(m, nom_champ, agg):
    q = flux_base(m)
    q += f' |> filter(fn: (r) => r._field == "{nom_champ}")'
    if agg == "derivative":
        q += ' |> derivative(unit: 1s, nonNegative: true)'
    elif agg == "last":
        q += ' |> last()'
    elif agg in ("count_running", "count_stations"):
        q += ' |> last() |> group() |> count()'
    else:
        q += ' |> aggregateWindow(every: 20s, fn: mean)'
    if m.get("diviser_par"):
        q += f' |> map(fn: (r) => ({{r with _value: r._value / float(v: {m["diviser_par"]})}}))'
    return q

def mtype(m):
    t = m["type"]
    return {"timeseries": "timeseries", "stat": "stat", "table": "table"}.get(t, "timeseries")

def panel(m, x, y, w, h):
    champs = m.get("champs") or ([m["champ"]] if m.get("champ") else [])
    topics = m.get("topics")
    targets, ref = [], "A"
    unit = m.get("unite", "short")
    if mtype(m) == "table":
        q = flux_base(m)
        cond = " or ".join([f'r._field == "{c}"' for c in champs]) if champs else None
        if cond: q += f' |> filter(fn: (r) => {cond})'
        q += ' |> last() |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")'
        targets.append({"refId": "A", "datasource": ds(), "query": q})
    elif champs:
        for i, c in enumerate(champs):
            targets.append({"refId": chr(65+i), "datasource": ds(), "query": requete_champ(m, c, m.get("aggregation"))})
    elif topics:
        for i, t in enumerate(topics):
            q = f'from(bucket: "sentinel") |> range(start: v.timeRangeStart, stop: v.timeRangeStop) |> filter(fn: (r) => r._measurement == "{m["mesure"]}" and r.topic == "{t}")'
            agg = m.get("aggregation")
            if agg == "derivative": q += ' |> derivative(unit: 1s, nonNegative: true)'
            elif agg == "last":     q += " |> last()"
            else:                   q += ' |> aggregateWindow(every: 20s, fn: mean)'
            if m.get("diviser_par"): q += f' |> map(fn: (r) => ({{r with _value: r._value / float(v: {m["diviser_par"]})}}))'
            targets.append({"refId": chr(65+i), "datasource": ds(), "query": q})
    fc_defaults = {"unit": unit}
    if unit == "percent": fc_defaults.update({"min": 0, "max": 100})
    if mtype(m) == "stat": fc_defaults["decimals"] = 1
    return {
        "id": int(uid_s(m["titre"])[:6]) or 1,
        "type": mtype(m), "title": m["titre"], "datasource": ds(),
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "fieldConfig": {"defaults": fc_defaults, "overrides": []},
        "options": {"showHeader": True, "cellHeight": "sm"} if mtype(m) == "table" else {},
        "description": m.get("note", ""),
        "targets": targets,
    }

def main():
    spec = json.load(open(SPEC))
    panels, y = [], 0
    for sec in spec["sections"]:
        actives = [m for m in sec["mesures"] if m.get("actif")]
        if not actives: continue
        panels.append({"type": "row", "title": sec["titre"], "collapsed": False,
                       "gridPos": {"h": 1, "w": 24, "x": 0, "y": y}, "panels": []})
        y += 1
        for m in actives:
            if mtype(m) == "stat": w, h = 6, 4
            elif mtype(m) == "table": w, h = 12, 8
            else: w, h = 12, 8
            panels.append(panel(m, 0, y, w, h))
            y += h
    dash = {"uid": spec["dashboard"]["uid"], "title": spec["dashboard"]["title"],
            "tags": ["sentinel","supervision"], "timezone": "browser", "schemaVersion": 39,
            "refresh": spec["dashboard"]["refresh"],
            "time": {"from": spec["dashboard"]["time_from"], "to": "now"},
            "templating": {"list": []}, "panels": panels}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dash, open(OUT, "w"), indent=2, ensure_ascii=False)
    print(f"Dashboard genere : {len(panels)} elements ({sum(1 for p in panels if p['type']!='row')} panneaux)")

main()
