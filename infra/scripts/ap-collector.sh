#!/bin/bash
# Ecrit les stations WiFi associees dans un fichier line-protocol
OUT=/var/lib/ap-stations/ap-stations.lp
mkdir -p /var/lib/ap-stations
TMP=$(mktemp)
timeout 10 /usr/sbin/iw dev wlan0 station dump 2>/dev/null | awk '
/^Station /            { if (mac!="") flush(); mac=$2; sig=""; rx=""; tx=""; next }
/signal:/              { gsub(/[[:space:]]/,"",$2); sig=$2; sub(" dBm","",sig); next }
/rx bytes:/            { rx=$3; next }
/tx bytes:/            { tx=$3; next }
END                    { if (mac!="") flush() }
function flush() {
  if (sig=="") return
  printf "ap_stations,interface=wlan0,station=%s signal_dbm=%s", mac, sig > "/dev/stderr"
}
' 2>/dev/null
timeout 10 /usr/sbin/iw dev wlan0 station dump 2>/dev/null | awk '
/^Station /   { if (mac!="") flush(); mac=$2; sig=""; rx=""; tx=""; next }
/signal:/     { gsub(/[[:space:]]/,"",$2); sig=$2; sub(" dBm","",sig); next }
/rx bytes:/   { rx=$3; next }
/tx bytes:/   { tx=$3; next }
END           { if (mac!="") flush() }
function flush() {
  if (sig=="") return
  line="ap_stations,interface=wlan0,station=" mac " signal_dbm=" sig
  if (rx!="") line=line ",rx_bytes=" rx "i"
  if (tx!="") line=line ",tx_bytes=" tx "i"
  print line
}' > "$TMP"
mv "$TMP" "$OUT"
