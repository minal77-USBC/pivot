import { useState } from "react";
import { tier, travelMins, leaveByFromMins, fmtDate, daysLabel, daysOut, mapsUrl, getOverrideMins, saveOverride } from "../utils";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";

export default function MatchCard({ m, kidColor = "#FF6B2B", compact = false, arrivalBuffer = 20 }) {
  const { t } = useLang();
  const { S, theme } = useTheme();
  const tierLevel = tier(m.km);
  const isRoad = tierLevel === "road";
  const n = daysOut(m.date);
  const days = daysLabel(m.date);
  const overrideMins = m.km > 0 ? getOverrideMins(m.venue, m.city) : null;
  const effectiveMins = overrideMins ?? travelMins(m.km);
  const leave = m.km > 0 ? leaveByFromMins(m.time, effectiveMins, arrivalBuffer) : null;

  const [editing, setEditing] = useState(false);
  const [draftMins, setDraftMins] = useState("");

  const saveTravel = () => {
    const n = parseInt(draftMins, 10);
    if (!isNaN(n) && n > 0) { saveOverride(m.venue, m.city, n); }
    setEditing(false);
    setDraftMins("");
    // force re-render by dispatching storage event
    window.dispatchEvent(new Event("storage"));
  };

  const clearOverride = () => {
    saveOverride(m.venue, m.city, null);
    setEditing(false);
    window.dispatchEvent(new Event("storage"));
  };

  const haBadge = m.ha === "home" ? "home" : isRoad ? "road" : "away";
  const haLabel = m.ha === "home" ? t.haHome : isRoad ? t.haRoad(m.city) : t.haAway(m.city);

  return (
    <div style={isRoad ? S.roadCard : S.card()}>
      <div style={S.spaceBetween}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={S.badge(haBadge)}>{haLabel}</span>
          {m.canvis && <span style={S.badge("canvis")}>⚠ Canvis</span>}
        </div>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: n <= 1 ? 15 : 13,
          fontWeight: n <= 1 ? 700 : 500,
          letterSpacing: "0.04em",
          color: n === 0 ? "#FF6B2B" : n === 1 ? "#22d3a0" : "#64748b",
        }}>{days}</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>
          {fmtDate(m.date)}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: theme.textBright, marginTop: 2, lineHeight: 1.3 }}>
          {m.ha === "home" ? "vs" : "@"} {m.opp}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{m.venue}</div>
      </div>

      {!compact && (
        <>
          <div style={S.divider} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={S.label}>{t.kickoff}</div>
              <div style={{ fontFamily: "'Barlow Condensed', monospace", fontSize: 22, fontWeight: 700, color: theme.textBright }}>
                {m.time}
              </div>
            </div>
            {leave && (
              <div style={{ textAlign: "right" }}>
                <div style={S.label}>{t.leaveBy}</div>
                <div style={{ fontFamily: "'Barlow Condensed', monospace", fontSize: 22, fontWeight: 700, color: kidColor }}>
                  {leave}
                </div>
              </div>
            )}
            {m.km > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={S.label}>{t.travel}</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      autoFocus
                      type="number"
                      value={draftMins}
                      onChange={e => setDraftMins(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveTravel(); if (e.key === "Escape") setEditing(false); }}
                      placeholder={String(travelMins(m.km))}
                      style={{
                        width: 60, background: "#1e293b", border: "1px solid #475569",
                        borderRadius: 6, color: theme.textBright, fontSize: 13, padding: "3px 8px",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#64748b" }}>{t.min}</span>
                    <button onClick={saveTravel} style={{ background: "#FF6B2B", border: "none", borderRadius: 4, color: "white", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>✓</button>
                    {overrideMins && (
                      <button onClick={clearOverride} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer" }}>reset</button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, color: isRoad ? "#ffb347" : theme.textSubtle, fontWeight: 500 }}>
                      {overrideMins ? `${overrideMins} ${t.min}` : `~${travelMins(m.km)} ${t.min}`} · {m.km}km
                    </span>
                    {overrideMins && <span style={{ fontSize: 9, color: "#22d3a0", letterSpacing: "0.08em" }}>{t.yours}</span>}
                    <button
                      onClick={() => { setDraftMins(String(overrideMins ?? travelMins(m.km))); setEditing(true); }}
                      style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                      title={t.editTravelTime}
                    >✏️</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {m.ha === "away" && (
            <a
              href={mapsUrl(m.venue, m.city)}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginTop: 12, padding: "10px 0", borderRadius: 8, textDecoration: "none",
                background: `${kidColor}18`, border: `1px solid ${kidColor}44`,
                color: kidColor, fontSize: 13, fontWeight: 600,
              }}
            >
              {t.openInMaps(m.venue)}
            </a>
          )}
        </>
      )}
    </div>
  );
}
