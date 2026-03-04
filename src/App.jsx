import { useState } from "react";
import { S } from "./styles";
import { useSchedule } from "./useSchedule";
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
  const { k1Matches, k2Matches, loading, error, refresh } = useSchedule();

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
          <div style={S.logo}>PIVOT</div>
          <div style={S.subtitle}>Basketball · BCN</div>
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
        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 13 }}>Loading schedule…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>Failed to load schedule: {error}</div>
            <button onClick={refresh} style={{ background: "#FF6B2B", border: "none", borderRadius: 6, color: "white", fontSize: 12, padding: "6px 14px", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {tab === "dash"     && <DashboardTab k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "calendar" && <CalendarTab  k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "matchday" && <ChecklistTab k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "season"   && <SeasonTab    k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "stats"    && <StatsTab     k1Matches={k1Matches} />}
          </>
        )}
      </div>
    </div>
  );
}
