import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { useSchedule } from "./useSchedule";
import { useFamily } from "./useFamily";
import { LangProvider, useLang } from "./LangContext";
import { ThemeProvider, useTheme } from "./ThemeContext";
import DashboardTab from "./tabs/DashboardTab";
import CalendarTab from "./tabs/CalendarTab";
import ChecklistTab from "./tabs/ChecklistTab";
import SeasonTab from "./tabs/SeasonTab";
import StatsTab from "./tabs/StatsTab";
import LoginScreen from "./LoginScreen";
import SetupScreen from "./SetupScreen";
import SettingsScreen from "./SettingsScreen";
import { Zap, Calendar, ClipboardList, TrendingUp, Activity, Settings, Loader2 } from "lucide-react";

function AppInner() {
  const { lang, setLanguage, t } = useLang();
  const { S, theme } = useTheme();

  const TABS = [
    { id: "dash",     label: t.tabDash,     Icon: Zap },
    { id: "calendar", label: t.tabCalendar,  Icon: Calendar },
    { id: "matchday", label: t.tabMatchDay,  Icon: ClipboardList },
    { id: "season",   label: t.tabSeason,    Icon: TrendingUp },
    { id: "stats",    label: t.tabStats,     Icon: Activity },
  ];

  const LANG_PILLS = [
    { id: "cat", label: "CAT" },
    { id: "es",  label: "ES" },
    { id: "en",  label: "EN" },
  ];

  const [user, setUser] = useState(loadStoredUser);
  const [tab, setTab] = useState("dash");
  const [setupKey, setSetupKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      track("share_copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (error) track("schedule_load_failed", { error: String(error).slice(0, 255) });
  }, [error]);

  const loadStartRef = useRef(Date.now());
  const trackedLoadRef = useRef(false);
  useEffect(() => {
    if (!loading && !error && kids?.length > 0 && !trackedLoadRef.current) {
      trackedLoadRef.current = true;
      track("schedule_rendered", { latencyMs: Date.now() - loadStartRef.current, kidCount: kids.length });
    }
  }, [loading, error, kids]);

  if (!shareToken && !user) return <LoginScreen onAuth={setUser} />;

  if (!shareToken && !familyLoading && kids !== null && kids.length === 0) {
    return <SetupScreen user={user} onSave={() => setSetupKey(k => k + 1)} />;
  }

  if (showSettings && kids?.length > 0) {
    return (
      <SettingsScreen
        user={user}
        kids={kids}
        onSave={() => setSetupKey(k => k + 1)}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${theme.bg}; }
        a { color: inherit; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { height: 4px; width: 4px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.cardBorder}; border-radius: 2px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>PIVOT</div>
          <div style={S.subtitle}>{t.subtitle}</div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {/* Language selector */}
          <div style={{ display: "flex", gap: 3 }}>
            {LANG_PILLS.map(({ id, label }) => (
              <button key={id} onClick={() => { setLanguage(id); track("language_changed", { lang: id }); }} style={{
                background: lang === id ? "rgba(255,107,43,0.15)" : "transparent",
                border: `1px solid ${lang === id ? "rgba(255,107,43,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 4, padding: "2px 6px", cursor: "pointer",
                color: lang === id ? "#FF6B2B" : "#334155", fontSize: 9, fontWeight: 600,
                letterSpacing: "0.05em",
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {shareUrl && (
              <button onClick={copyShare} style={{
                background: copied ? "rgba(34,211,160,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${copied ? "rgba(34,211,160,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                color: copied ? "#22d3a0" : "#64748b", fontSize: 10, fontWeight: 500,
              }}>
                {copied ? t.copied : t.share}
              </button>
            )}
            {!shareToken && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowSettings(true); track("settings_opened"); }}
                  title={t.settings}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer", padding: "3px 6px", lineHeight: 1, color: "#64748b", display: "flex", alignItems: "center" }}
                ><Settings size={14} /></button>
                <button
                  onClick={() => { sessionStorage.removeItem("pivot_auth"); setUser(null); track("user_signed_out"); }}
                  title={`Signed in as ${user?.email}`}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
                >
                  {user?.picture
                    ? <img src={user.picture} alt="" style={{ width: 20, height: 20, borderRadius: "50%", opacity: 0.6 }} />
                    : <span style={{ fontSize: 16 }}>👤</span>
                  }
                  <span style={{ fontSize: 10, color: "#334155" }}>{t.signOut}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(tb => (
          <button key={tb.id} style={S.tab(tab === tb.id)} onClick={() => { setTab(tb.id); track("tab_viewed", { tab: tb.id }); }}>
            <tb.Icon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.body}>
        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
            </div>
            <div style={{ fontSize: 13 }}>{t.loading}</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>{t.failedToLoad} {error}</div>
            <button onClick={() => { refresh(); track("schedule_retry"); }} style={{ background: "#FF6B2B", border: "none", borderRadius: 6, color: "white", fontSize: 12, padding: "6px 14px", cursor: "pointer" }}>
              {t.retry}
            </button>
          </div>
        )}

        {!loading && !error && kids?.length > 0 && (
          <>
            {tab === "dash"     && <DashboardTab kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
            {tab === "calendar" && <CalendarTab  kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
            {tab === "matchday" && <ChecklistTab kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
            {tab === "season"   && <SeasonTab    kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
            {tab === "stats"    && <StatsTab     kids={kids} k1Matches={k1Matches} k2Matches={k2Matches} k3Matches={k3Matches} />}
          </>
        )}
      </div>
    </div>
  );
}

function loadStoredUser() {
  try {
    const stored = JSON.parse(sessionStorage.getItem("pivot_auth") || "null");
    if (stored && stored.exp * 1000 > Date.now()) return stored;
    sessionStorage.removeItem("pivot_auth");
  } catch { /* ignore */ }
  return null;
}

function resolveShareToken() {
  // Primary: token embedded in URL param by share.js redirect and manifest start_url.
  // This is the only approach that reliably survives iOS PWA launches — iOS must
  // honour start_url on every launch, so the token arrives in the URL itself.
  const urlToken = new URLSearchParams(window.location.search).get("share_token");
  if (urlToken) {
    localStorage.setItem("pivot_share_token", urlToken);
    return urlToken;
  }
  // Fallback: localStorage for subsequent SPA navigations within the same session
  // where the URL param is no longer present.
  return localStorage.getItem("pivot_share_token") || null;
}

const shareToken = resolveShareToken();

export default function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <AppInner />
        <Analytics />
      </ThemeProvider>
    </LangProvider>
  );
}
