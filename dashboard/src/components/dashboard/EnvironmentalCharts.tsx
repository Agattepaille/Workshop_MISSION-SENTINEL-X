import EnvironmentalChart from "./EnvironmentalChart";

export default function EnvironmentalCharts() {
  return (
    <section className="w-[400px] flex flex-col bg-black">
      <div className="flex-1 border-b border-neutral-800">
        <EnvironmentalChart
          title="Température & Humidité (24h)"
          dataSubtitle="Dernières 24h"
          footerText="Min 18.2°C • Max 28.9°C • Moy 22.7°C"
        />
      </div>
      <div className="flex-1">
        <EnvironmentalChart
          title="Gaz / Fumée (MQ-2) (12h)"
          dataSubtitle="ppm"
          footerText="Seuil critique: 400 ppm • Situation: Normal"
        />
      </div>
    </section>
  );
}
