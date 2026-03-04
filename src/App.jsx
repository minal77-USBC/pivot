import { useState } from "react";
import { S } from "./styles";
import DashboardTab from "./tabs/DashboardTab";
import CalendarTab from "./tabs/CalendarTab";
import ChecklistTab from "./tabs/ChecklistTab";
import SeasonTab from "./tabs/SeasonTab";
import StatsTab from "./tabs/StatsTab";

const TABS = [
  { id: "dash",     label: "Dashboard", icon: "⚡" },
  { id: "calendar", label: "Calendari", icon: "📅" },
  { id: "matchday", label: "Match Day",  icon: "🎒" },
  { id: "season",   label: "Season",    icon: "📊" },
  { id: "stats",    label: "Stats",     icon: "🏀" },
];

export default function App() {
  const [tab, setTab] = useState("dash");

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070912; }
        a { color: inherit; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { height: 4px; width: 4px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>CANCHA</div>
          <div style={S.subtitle}>Basketball Command Center · BCN</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.08em" }}>2025–26</div>
          <div style={{ fontSize: 11, color: "#334155" }}>Grup Barna Vermell</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.body}>
        {tab === "dash"     && <DashboardTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "matchday" && <ChecklistTab />}
        {tab === "season"   && <SeasonTab />}
        {tab === "stats"    && <StatsTab />}
      </div>
    </div>
  );
}
