import { useState, useEffect } from "react";
import { S } from "../styles";

export default function ScoutCard({ match, kid }) {
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
    });
    fetch(`/api/scout?${params}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [match?.oppTeamId, kid?.statsTeamId, match?.date]);

  if (!match?.oppTeamId || !kid?.statsTeamId) return null;

  if (loading) return (
    <div style={{ ...S.card(), display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
      <span style={{ fontSize: 14 }}>🔍</span>
      <span style={{ fontSize: 12, color: "#475569" }}>Loading scout report…</span>
    </div>
  );

  if (error) return (
    <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.2)" }), fontSize: 12, color: "#475569", padding: "10px 14px" }}>
      Scout report unavailable
    </div>
  );

  const { record, topPlayers, h2h } = data;
  const c = kid.color;

  return (
    <div style={{
      background: "#0f172a",
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
          }}>Scout Report</span>
        </div>
        <span style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>{match.opp}</span>
      </div>

      {/* Record bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#22d3a0", lineHeight: 1 }}>
            {record.wins}W
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {record.gp} played
          </div>
        </div>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#ff4757", lineHeight: 1 }}>
            {record.losses}L
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            losses
          </div>
        </div>
        <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>
            {record.ppf?.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            PPG for
          </div>
        </div>
        {record.ppa != null && (
          <div style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}>
              {record.ppa?.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
              PPG ag.
            </div>
          </div>
        )}
      </div>

      {/* H2H pill — only when within 2-week window */}
      {h2h && h2h.playedTimes > 0 && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${c}12`, border: `1px solid ${c}33`,
          borderRadius: 6, padding: "4px 10px", marginBottom: 10,
          fontSize: 11, fontWeight: 600, color: c,
        }}>
          H2H THIS SEASON · {h2h.homeWins}–{h2h.awayWins}
          <span style={{ fontWeight: 400, color: "#475569" }}>({h2h.playedTimes} {h2h.playedTimes === 1 ? "game" : "games"})</span>
        </div>
      )}

      {/* Threats */}
      {topPlayers.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
            Threats
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "18px minmax(60px,1fr) 36px 36px 36px 32px 36px",
            gap: 4, padding: "0 4px 4px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            marginBottom: 4,
          }}>
            {["#", "Name", "GP", "PPG", "RPG", "APG", "FT%"].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 1 ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {topPlayers.map((p, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "18px minmax(60px,1fr) 36px 36px 36px 32px 36px",
              gap: 4, padding: "6px 4px",
              borderBottom: i < topPlayers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal}</span>
              <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ fontSize: 10, color: "#475569", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.gp}</span>
              <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 700, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.ppg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.rpg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.apg.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.ft}</span>
            </div>
          ))}
        </>
      )}

      <div style={{ fontSize: 9, color: "#1e293b", textAlign: "right", marginTop: 8 }}>
        Source: FCBQ / msstats · Season averages
      </div>
    </div>
  );
}
