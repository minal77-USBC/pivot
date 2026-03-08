import { useState, useEffect } from "react";
import { fmtDate } from "../utils";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";

export default function ScoutCard({ match, kid }) {
  const { t } = useLang();
  const { S, theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!match?.oppTeamId || !kid?.statsTeamId) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({
      oppTeamId: match.oppTeamId,
      ourTeamId: kid.statsTeamId,
      matchDate: match.date,
      ...(match.grupId ? { grupId: match.grupId } : {}),
    });
    fetch(`/api/scout?${params}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [match?.oppTeamId, kid?.statsTeamId, match?.date, match?.grupId]);

  if (!match?.oppTeamId || !kid?.statsTeamId) return null;

  if (loading) return (
    <div style={{ ...S.card(), display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
      <span style={{ fontSize: 14 }}>🔍</span>
      <span style={{ fontSize: 12, color: "#475569" }}>{t.scoutLoading}</span>
    </div>
  );

  if (error) return (
    <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.2)" }), fontSize: 12, color: "#475569", padding: "10px 14px" }}>
      {t.scoutUnavailable}
    </div>
  );

  const { record, topPlayers, h2h, recentForm } = data;
  const c = kid.color;

  return (
    <div style={{
      background: theme.cardAlt,
      border: `1px solid ${c}22`,
      borderLeft: `3px solid ${c}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11 }}>🔍</span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "#64748b",
          }}>{t.scoutReport}</span>
        </div>
        <span style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>{match.opp}</span>
      </div>

      {/* Record bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#22d3a0", lineHeight: 1 }}>
            {record.wins}{t.wLabel}
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {record.gp} {t.scoutPlayed}
          </div>
        </div>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#ff4757", lineHeight: 1 }}>
            {record.losses}{t.lLabel}
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {t.scoutLosses}
          </div>
        </div>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: theme.textBright, lineHeight: 1 }}>
            {record.ppf?.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {t.scoutPpgFor}
          </div>
        </div>
        {record.ppa != null && (
          <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: theme.textSubtle, lineHeight: 1 }}>
              {record.ppa?.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
              {t.scoutPpgAg}
            </div>
          </div>
        )}
      </div>

      {/* H2H pill */}
      {h2h && h2h.playedTimes > 0 && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${c}12`, border: `1px solid ${c}33`,
          borderRadius: 6, padding: "4px 10px", marginBottom: 10,
          fontSize: 11, fontWeight: 600, color: c,
        }}>
          {t.h2hLabel} · {h2h.homeWins}–{h2h.awayWins}
          <span style={{ fontWeight: 400, color: "#475569" }}>{t.h2hGames(h2h.playedTimes)}</span>
        </div>
      )}

      {/* Recent form */}
      {recentForm?.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
            {t.scoutRecentForm}
          </div>
          {/* Form dots */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {recentForm.map((m, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: m.win ? "rgba(34,211,160,0.15)" : "rgba(255,71,87,0.15)",
                border: `1px solid ${m.win ? "rgba(34,211,160,0.35)" : "rgba(255,71,87,0.35)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: m.win ? "#22d3a0" : "#ff4757",
              }}>
                {m.win ? t.wLabel : t.lLabel}
              </div>
            ))}
          </div>
          {/* Result rows */}
          {recentForm.map((m, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 4px",
              borderBottom: i < recentForm.length - 1 ? `1px solid ${theme.rowBorder}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  color: m.win ? "#22d3a0" : "#ff4757",
                  flexShrink: 0,
                }}>
                  {m.win ? t.wLabel : t.lLabel}
                </span>
                <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                  {m.ha === "home" ? "vs" : "@"}
                </span>
                <span style={{ fontSize: 11, color: theme.textSubtle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.opp}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{m.score}</span>
                <span style={{ fontSize: 10, color: "#334155" }}>{fmtDate(m.date)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Threats */}
      {topPlayers.length > 0 && (
        <>
          <div style={{ height: 1, background: theme.divider, margin: "10px 0 8px" }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
            {t.scoutThreats}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "18px minmax(60px,1fr) 36px 36px 36px 32px 36px",
            gap: 4, padding: "0 4px 4px",
            borderBottom: `1px solid ${theme.rowBorder}`,
            marginBottom: 4,
          }}>
            {["#", "Name", "GP", "PPG", "RPG", "APG", "FT%"].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 1 ? "right" : "left" }}>{h}</span>
            ))}
          </div>
          {topPlayers.map((p, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "18px minmax(60px,1fr) 36px 36px 36px 32px 36px",
              gap: 4, padding: "6px 4px",
              borderBottom: i < topPlayers.length - 1 ? `1px solid ${theme.rowBorder}` : "none",
            }}>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal}</span>
              <span style={{ fontSize: 12, color: theme.textPrimary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ fontSize: 10, color: "#475569", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.gp}</span>
              <span style={{ fontSize: 12, color: theme.textBright, fontWeight: 700, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.ppg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.rpg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.apg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.ft}</span>
            </div>
          ))}
        </>
      )}

      <div style={{ fontSize: 9, color: theme.textMuted, textAlign: "right", marginTop: 8 }}>
        {t.scoutSource}
      </div>
    </div>
  );
}
