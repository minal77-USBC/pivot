import { useState } from "react";
import { S } from "./styles";
import { useSchedule } from "./useSchedule";
import { useFamily } from "./useFamily";
import DashboardTab from "./tabs/DashboardTab";
import CalendarTab from "./tabs/CalendarTab";
import ChecklistTab from "./tabs/ChecklistTab";
import SeasonTab from "./tabs/SeasonTab";
import StatsTab from "./tabs/StatsTab";
import LoginScreen from "./LoginScreen";
import SetupScreen from "./SetupScreen";

const TABS = [
  { id: "dash",     label: "Dashboard", icon: "⚡" },
  { id: "calendar", label: "Calendar",  icon: "📅" },
  { id: "matchday", label: "Match Day", icon: "🎒" },
  { id: "season",   label: "Season",    icon: "📊" },
  { id: "stats",    label: "Stats",     icon: "🏀" },
];

function loadStoredUser() {
  try {
    const stored = JSON.parse(sessionStorage.getItem("pivot_auth") || "null");
    if (stored && stored.exp * 1000 > Date.now()) return stored;
    sessionStorage.removeItem("pivot_auth");
  } catch { /* ignore */ }
  return null;
}

const shareToken = new URLSearchParams(window.location.search).get("family");

export default function App() {
  const [user, setUser] = useState(loadStoredUser);
  const [tab, setTab] = useState("dash");
  const [setupKey, setSetupKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const { kids, loading: familyLoading, error: familyError, shareUrl } = useFamily(user, setupKey, shareToken);
  const { kidMatches, loading: schedLoading, error: schedError, refresh } = useSchedule(kids);

  const loading = familyLoading || (kids?.length > 0 && schedLoading);
  const error = schedError || familyError;

  const k1Matches = kidMatches[kids?.[0]?.id] || [];
  const k2Matches = kidMatches[kids?.[1]?.id] || [];
  const k3Matches = kidMatches[kids?.[2]?.id] || [];

  const copyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Token-based access: skip login, go straight to app
  if (!shareToken && !user) return <LoginScreen onAuth={setUser} />;

  // Family not yet configured — show one-time setup (email flow only)
  if (!shareToken && !familyLoading && kids !== null && kids.length === 0) {
    return <SetupScreen user={user} onSave={() => setSetupKey(k => k + 1)} />;
  }

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
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.08em" }}>2025–26</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {shareUrl && (
              <button onClick={copyShare} style={{
                background: copied ? "rgba(34,211,160,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${copied ? "rgba(34,211,160,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                color: copied ? "#22d3a0" : "#64748b", fontSize: 10, fontWeight: 500,
              }}>
                {copied ? "Copied!" : "🔗 Share"}
              </button>
            )}
            {!shareToken && (
              <button
                onClick={() => { sessionStorage.removeItem("pivot_auth"); setUser(null); }}
                title={`Signed in as ${user?.email}`}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
              >
                {user?.picture
                  ? <img src={user.picture} alt="" style={{ width: 20, height: 20, borderRadius: "50%", opacity: 0.6 }} />
                  : <span style={{ fontSize: 16 }}>👤</span>
                }
                <span style={{ fontSize: 10, color: "#334155" }}>Sign out</span>
              </button>
            )}
          </div>
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
            <div style={{ fontSize: 13 }}>Loading…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>Failed to load: {error}</div>
            <button onClick={refresh} style={{ background: "#FF6B2B", border: "none", borderRadius: 6, color: "white", fontSize: 12, padding: "6px 14px", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && kids?.length > 0 && (
          <>
            {tab === "dash"     && <DashboardTab kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "calendar" && <CalendarTab  kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "matchday" && <ChecklistTab kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} />}
            {tab === "season"   && <SeasonTab    kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
            {tab === "stats"    && <StatsTab     kids={kids} k1Matches={k1Matches} />}
          </>
        )}
      </div>
    </div>
  );
}
