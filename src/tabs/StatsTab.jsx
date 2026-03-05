import { useState, useEffect } from "react";
import { S } from "../styles";
import { KIDS } from "../data";
import { fmtDate } from "../utils";

const MSSTATS_BASE = "https://msstats.optimalwayconsulting.com/v1/fcbq";
const TEAM_ID = "80316";
const SEASON = "2025";

function pct(made, attempted) {
  if (!attempted) return "—";
  return `${Math.round((made / attempted) * 100)}%`;
}

function StatRow({ p, isRohan, border }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "24px minmax(70px,1fr) 30px 40px 40px 44px 36px 36px 40px",
      gap: 4,
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: border ? "1px solid rgba(255,255,255,0.04)" : "none",
      background: isRohan ? "rgba(255,107,43,0.07)" : "transparent",
      borderLeft: isRohan ? "2px solid #FF6B2B" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal || "—"}</span>
      <span style={{ fontSize: 12, color: isRohan ? "#FF6B2B" : "#e2e8f0", fontWeight: isRohan ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.name.split(" ")[0]}
      </span>
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.matchesPlayed}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumTimePlayed ?? "—"}</span>
      <span style={{ fontSize: 12, color: "#f1f5f9", textAlign: "right", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{p.totalScoreAvgByMatch.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.totalScore}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumShotsOfOneSuccessful}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumShotsOfThreeSuccessful}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumValorationAvgByMatch.toFixed(1)}</span>
    </div>
  );
}

function BoxScoreRow({ p, isRohan, border }) {
  const d = p.data || {};
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "20px minmax(70px,1fr) 28px 32px 36px 36px 28px 28px 28px 28px 32px",
      gap: 3,
      alignItems: "center",
      padding: "7px 10px",
      borderBottom: border ? "1px solid rgba(255,255,255,0.04)" : "none",
      background: isRohan ? "rgba(255,107,43,0.07)" : "transparent",
      borderLeft: isRohan ? "2px solid #FF6B2B" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 9, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal}</span>
      <span style={{ fontSize: 11, color: isRohan ? "#FF6B2B" : "#e2e8f0", fontWeight: isRohan ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.starting ? "★ " : ""}{p.name.split(" ")[0]}
      </span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.timePlayed}</span>
      <span style={{ fontSize: 12, color: "#f1f5f9", textAlign: "right", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{d.score ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.shotsOfOneSuccessful ?? 0}/{d.shotsOfOneAttempted ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.shotsOfTwoSuccessful ?? 0}/{d.shotsOfTwoAttempted ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.rebounds ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.assists ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.steals ?? 0}</span>
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{d.faults ?? 0}</span>
      <span style={{ fontSize: 10, color: p.inOut > 0 ? "#22d3a0" : p.inOut < 0 ? "#ff4757" : "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
        {p.inOut > 0 ? "+" : ""}{p.inOut ?? 0}
      </span>
    </div>
  );
}

function SeasonStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = `${MSSTATS_BASE}/team-stats/team/${TEAM_ID}/season/${SEASON}`;
    fetch(`/api/fcbq?url=${encodeURIComponent(url)}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      Loading season stats…
    </div>
  );

  if (error) return (
    <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
      Failed to load stats: {error}
    </div>
  );

  const team = data.team;
  const players = [...(data.players || [])].sort((a, b) => b.totalScoreAvgByMatch - a.totalScoreAvgByMatch);

  return (
    <>
      {/* Team summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#22d3a0", fontSize: 24 }}>{team.teamResults.wins}W</div>
          <div style={S.statLbl}>{team.sumMatches} played</div>
        </div>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#ff4757", fontSize: 24 }}>{team.teamResults.losses}L</div>
          <div style={S.statLbl}>losses</div>
        </div>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#FF6B2B", fontSize: 24 }}>{team.totalScoreAvgByMatch.toFixed(1)}</div>
          <div style={S.statLbl}>PPG for</div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ ...S.card({ padding: "0" }), overflowX: "auto" }}>
        <div style={{ minWidth: 460 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "24px minmax(70px,1fr) 30px 40px 40px 44px 36px 36px 40px",
            gap: 4,
            padding: "6px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
          }}>
            {["#", "Player", "GP", "MIN", "PPG", "PTS", "FT", "3P", "VAL"].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: i > 1 ? "right" : "left" }}>{h}</span>
            ))}
          </div>
          {players.map((p, i) => (
            <StatRow key={p.uuid || i} p={p} isRohan={p.name.includes("ROHAN")} border={i < players.length - 1} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#334155", textAlign: "center", marginTop: 8 }}>
        VAL = valoration (efficiency). FT/3P = made. Source: FCBQ / msstats
      </div>
    </>
  );
}

function MatchBoxScores({ k1Matches }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [boxScore, setBoxScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const playedMatches = k1Matches.filter(m => m.played).slice().reverse();

  const loadBoxScore = async (match) => {
    if (!match.statsUuid) {
      setSelectedMatch(match);
      setBoxScore(null);
      setError("Box score not yet available — UUID not loaded. Check back after proxy scraping is set up.");
      return;
    }
    setSelectedMatch(match);
    setBoxScore(null);
    setError(null);
    setLoading(true);
    try {
      const url = `${MSSTATS_BASE}/getJsonWithMatchStats/${match.statsUuid}`;
      const r = await fetch(`/api/fcbq?url=${encodeURIComponent(url)}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      setBoxScore(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const grupBarnaTeam = boxScore?.teams?.find(t =>
    t.name?.includes("BARNA") || t.name?.includes("GRUP")
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        Tap a match to see the full box score.
      </div>

      {/* Match list */}
      {!selectedMatch && playedMatches.map((m, i) => (
        <div key={i} onClick={() => loadBoxScore(m)}
          style={{ ...S.card({ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }) }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(m.date)}</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{m.ha === "home" ? "vs" : "@"} {m.opp}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757" }}>{m.win ? "W" : "L"} {m.score}</span>
            <span style={{ color: "#334155", fontSize: 14 }}>›</span>
          </div>
        </div>
      ))}

      {/* Back + box score */}
      {selectedMatch && (
        <>
          <button onClick={() => { setSelectedMatch(null); setBoxScore(null); setError(null); }}
            style={{ background: "none", border: "none", color: "#FF6B2B", cursor: "pointer", fontSize: 13, marginBottom: 12, padding: 0 }}>
            ← Back to matches
          </button>

          <div style={S.heroCard}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{fmtDate(selectedMatch.date)}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginTop: 2 }}>
              {selectedMatch.ha === "home" ? "vs" : "@"} {selectedMatch.opp}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: selectedMatch.win ? "#22d3a0" : "#ff4757", marginTop: 4 }}>
              {selectedMatch.win ? "W" : "L"} {selectedMatch.score}
            </div>
          </div>

          {loading && <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>⏳ Loading box score…</div>}
          {error && <div style={{ ...S.card({ borderColor: "rgba(255,179,71,0.3)" }), color: "#ffb347", fontSize: 12 }}>{error}</div>}

          {grupBarnaTeam && (
            <>
              <div style={S.sectionTitle}>Grup Barna</div>
              <div style={{ ...S.card({ padding: "0" }), overflowX: "auto" }}>
                <div style={{ minWidth: 480 }}>
                  {/* Column headers */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "20px minmax(70px,1fr) 28px 32px 36px 36px 28px 28px 28px 28px 32px",
                    gap: 3,
                    padding: "5px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                  }}>
                    {["#", "Player", "MIN", "PTS", "FT", "2P", "REB", "AST", "STL", "PF", "+/-"].map((h, i) => (
                      <span key={i} style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: i > 1 ? "right" : "left" }}>{h}</span>
                    ))}
                  </div>
                  {grupBarnaTeam.players.map((p, i) => (
                    <BoxScoreRow key={i} p={p} isRohan={p.name?.includes("ROHAN")} border={i < grupBarnaTeam.players.length - 1} />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function StatsTab({ k1Matches }) {
  const [kidId, setKidId] = useState("k1");
  const [view, setView] = useState("season");

  return (
    <div>
      {/* Kid selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {KIDS.map(ki => (
          <button key={ki.id} onClick={() => setKidId(ki.id)} style={S.kidBtn(kidId === ki.id, ki.color)}>
            {ki.label} · {ki.shortName}
          </button>
        ))}
      </div>

      {kidId === "k2" ? (
        <div style={{ ...S.card({ borderColor: "rgba(168,85,247,0.2)", background: "rgba(168,85,247,0.04)" }), textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, color: "#a855f7", fontWeight: 600, marginBottom: 6 }}>Stats not available</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
            FCBQ publishes detailed statistics for Preferent category only.<br />
            Sara plays Infantil Femení Promoció — no stats published.
          </div>
          <a href="https://www.basquetcatala.cat/equip/81179" target="_blank" rel="noreferrer"
            style={{ ...S.mapsBtn, marginTop: 14, display: "inline-flex", color: "#a855f7", borderColor: "rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.1)" }}>
            View on FCBQ →
          </a>
        </div>
      ) : (
        <>
          {/* Sub-tab toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#111827", borderRadius: 10, padding: 4 }}>
            {[["season", "Season Totals"], ["box", "Box Scores"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, background: view === id ? "#FF6B2B" : "transparent",
                border: "none", borderRadius: 7, padding: "7px 0",
                color: view === id ? "white" : "#475569", fontSize: 12, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          {view === "season" ? <SeasonStats /> : <MatchBoxScores k1Matches={k1Matches} />}
        </>
      )}
    </div>
  );
}
