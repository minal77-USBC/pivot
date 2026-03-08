import { useState, useEffect } from "react";
import { fmtDate } from "../utils";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";

const MSSTATS_BASE = "https://msstats.optimalwayconsulting.com/v1/fcbq";
// Season: basketball year starts in September (month >= 8)
const SEASON = String(
  new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
);

function pct(made, attempted) {
  if (!attempted) return "—";
  return `${Math.round((made / attempted) * 100)}%`;
}

function StatRow({ p, isHighlighted, border }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "24px minmax(70px,1fr) 30px 40px 40px 44px 36px 36px 40px",
      gap: 4,
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: border ? "1px solid rgba(255,255,255,0.04)" : "none",
      background: isHighlighted ? "rgba(255,107,43,0.07)" : "transparent",
      borderLeft: isHighlighted ? "2px solid #FF6B2B" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal || "—"}</span>
      <span style={{ fontSize: 12, color: isHighlighted ? "#FF6B2B" : "#e2e8f0", fontWeight: isHighlighted ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.name.split(" ")[0]}
      </span>
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.matchesPlayed}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.timePlayed ?? "—"}</span>
      <span style={{ fontSize: 12, color: "#f1f5f9", textAlign: "right", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{p.totalScoreAvgByMatch.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.totalScore}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumShotsOfOneSuccessful}</span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumShotsOfThreeSuccessful}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{p.sumValorationAvgByMatch.toFixed(1)}</span>
    </div>
  );
}

function BoxScoreRow({ p, isHighlighted, border }) {
  const d = p.data || {};
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "20px minmax(70px,1fr) 28px 32px 36px 36px 28px 28px 28px 28px 32px",
      gap: 3,
      alignItems: "center",
      padding: "7px 10px",
      borderBottom: border ? "1px solid rgba(255,255,255,0.04)" : "none",
      background: isHighlighted ? "rgba(255,107,43,0.07)" : "transparent",
      borderLeft: isHighlighted ? "2px solid #FF6B2B" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 9, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{p.dorsal}</span>
      <span style={{ fontSize: 11, color: isHighlighted ? "#FF6B2B" : "#e2e8f0", fontWeight: isHighlighted ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

function SeasonStats({ teamId, kidName, onResult }) {
  const { t } = useLang();
  const { S } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null); setLoading(true); setError(null);
    const url = `${MSSTATS_BASE}/team-stats/team/${teamId}/season/${SEASON}`;
    fetch(`/api/fcbq?url=${encodeURIComponent(url)}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); onResult?.(true); })
      .catch(e => { setError(e.message); setLoading(false); onResult?.(false); });
  }, [teamId]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      {t.loadingStats}
    </div>
  );

  // Parent handles the not-available UI via onResult(false)
  if (error) return null;

  const team = data.team;
  const players = [...(data.players || [])].sort((a, b) => b.totalScoreAvgByMatch - a.totalScoreAvgByMatch);

  return (
    <>
      {/* Team summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#22d3a0", fontSize: 24 }}>{team.teamResults.wins}{t.wLabel}</div>
          <div style={S.statLbl}>{team.sumMatches} {t.playedLabel}</div>
        </div>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#ff4757", fontSize: 24 }}>{team.teamResults.losses}{t.lLabel}</div>
          <div style={S.statLbl}>{t.lossesLabel}</div>
        </div>
        <div style={S.statBox}>
          <div style={{ ...S.statNum, color: "#FF6B2B", fontSize: 24 }}>{team.totalScoreAvgByMatch.toFixed(1)}</div>
          <div style={S.statLbl}>{t.ppgFor}</div>
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
            <StatRow
              key={p.uuid || i}
              p={p}
              isHighlighted={p.name.toUpperCase().includes(kidName.toUpperCase())}
              border={i < players.length - 1}
            />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#334155", textAlign: "center", marginTop: 8 }}>
        VAL = valoration (efficiency). FT/3P = made. Source: FCBQ / msstats
      </div>
    </>
  );
}

function PlayerGameLog({ kidMatches, kidName }) {
  const { t } = useLang();
  const { S } = useTheme();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const played = kidMatches
      .filter(m => m.played)
      .map(({ statsUuid, date, opp, ha, win, score }) => ({ statsUuid, date, opp, ha, win, score }));

    const params = new URLSearchParams({
      kidName,
      matches: JSON.stringify(played),
    });
    fetch(`/api/player-log?${params}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setLog(d.log); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [kidName]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      {t.loadingGameLog}
    </div>
  );

  if (error) return (
    <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
      {t.failedStats} {error}
    </div>
  );

  if (!log?.length) return (
    <div style={{ ...S.card(), color: "#64748b", fontSize: 12, textAlign: "center", padding: 28, lineHeight: 1.6 }}>
      {t.gameLogEmpty}
    </div>
  );

  // Totals row
  const gp = log.length;
  const avgOf = (key) => (log.reduce((s, r) => s + (r[key] ?? 0), 0) / gp).toFixed(1);

  return (
    <div>
      {/* Averages summary */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { val: avgOf("pts"),  lbl: "PPG" },
          { val: avgOf("reb"),  lbl: "RPG" },
          { val: avgOf("ast"),  lbl: "APG" },
          { val: avgOf("plusMinus"), lbl: "+/-" },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={{ ...S.statBox, flex: 1, padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#FF6B2B", lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Game log table */}
      <div style={{ ...S.card({ padding: 0 }), overflowX: "auto" }}>
        <div style={{ minWidth: 480 }}>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(90px,1fr) 28px 34px 38px 38px 28px 26px 34px",
            gap: 3, padding: "6px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
          }}>
            {["Match", "MIN", "PTS", "2P", "FT", "REB", "AST", "+/-"].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: i > 0 ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {log.map((r, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px,1fr) 28px 34px 38px 38px 28px 26px 34px",
              gap: 3, padding: "8px 10px",
              borderBottom: i < log.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              background: r.starting ? "rgba(255,107,43,0.04)" : "transparent",
            }}>
              {/* Match cell — two lines */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: r.win ? "#22d3a0" : "#ff4757",
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>
                    {r.win ? t.wLabel : t.lLabel}
                  </span>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{r.matchScore}</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {r.ha === "home" ? "vs" : "@"} {r.opp}
                </div>
              </div>

              <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.min}</span>
              <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 700, textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.pts}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.twoM}/{r.twoA}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.ftM}/{r.ftA}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.reb}</span>
              <span style={{ fontSize: 10, color: "#64748b", textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center" }}>{r.ast}</span>
              <span style={{
                fontSize: 10, textAlign: "right", fontFamily: "'DM Mono', monospace", alignSelf: "center",
                color: r.plusMinus > 0 ? "#22d3a0" : r.plusMinus < 0 ? "#ff4757" : "#64748b",
              }}>
                {r.plusMinus > 0 ? "+" : ""}{r.plusMinus}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#334155", textAlign: "center", marginTop: 8 }}>
        {gp} {t.playedLabel} · Source: FCBQ / msstats
      </div>
    </div>
  );
}

function MatchBoxScores({ kidMatches, kidName }) {
  const { t } = useLang();
  const { S } = useTheme();
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [boxScore, setBoxScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const playedMatches = kidMatches.filter(m => m.played).slice().reverse();

  const loadBoxScore = async (match) => {
    if (!match.statsUuid) {
      setSelectedMatch(match);
      setBoxScore(null);
      setError("Box score not yet available — check back 24–48h after the match.");
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

  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        {t.tapMatch}
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
            <span style={{ fontSize: 14, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757" }}>{m.win ? t.wLabel : t.lLabel} {m.score}</span>
            <span style={{ color: "#334155", fontSize: 14 }}>›</span>
          </div>
        </div>
      ))}

      {/* Back + box score */}
      {selectedMatch && (
        <>
          <button onClick={() => { setSelectedMatch(null); setBoxScore(null); setError(null); }}
            style={{ background: "none", border: "none", color: "#FF6B2B", cursor: "pointer", fontSize: 13, marginBottom: 12, padding: 0 }}>
            {t.backToMatches}
          </button>

          <div style={S.heroCard}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{fmtDate(selectedMatch.date)}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginTop: 2 }}>
              {selectedMatch.ha === "home" ? "vs" : "@"} {selectedMatch.opp}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: selectedMatch.win ? "#22d3a0" : "#ff4757", marginTop: 4 }}>
              {selectedMatch.win ? t.wLabel : t.lLabel} {selectedMatch.score}
            </div>
          </div>

          {loading && <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>{t.loadingBoxScore}</div>}
          {error && <div style={{ ...S.card({ borderColor: "rgba(255,179,71,0.3)" }), color: "#ffb347", fontSize: 12 }}>{error}</div>}

          {boxScore?.teams?.map((team, ti) => (
            <div key={ti}>
              <div style={S.sectionTitle}>{team.name}</div>
              <div style={{ ...S.card({ padding: "0" }), overflowX: "auto", marginBottom: 12 }}>
                <div style={{ minWidth: 480 }}>
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
                  {team.players.map((p, i) => (
                    <BoxScoreRow
                      key={i}
                      p={p}
                      isHighlighted={p.name?.toUpperCase().includes(kidName.toUpperCase())}
                      border={i < team.players.length - 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function StatsTab({ kids = [], k1Matches, k2Matches = [], k3Matches = [] }) {
  const { t } = useLang();
  const { S } = useTheme();
  const [kidId, setKidId] = useState("k1");
  const [view, setView] = useState("season");
  const [statsConfirmed, setStatsConfirmed] = useState(null); // null=probing, true=available, false=not available
  const selectedKid = kids.find(k => k.id === kidId) || kids[0];
  const kidMatchesMap = { k1: k1Matches, k2: k2Matches, k3: k3Matches };
  const selectedMatches = kidMatchesMap[selectedKid?.id] || k1Matches;

  const switchKid = (id) => { setKidId(id); setStatsConfirmed(null); setView("season"); };

  const notAvailable = !selectedKid?.statsAvailable || statsConfirmed === false;
  const subTabs = statsConfirmed === true
    ? [["season", t.seasonTotals], ["box", t.boxScores], ["log", t.gameLog]]
    : [["season", t.seasonTotals]];

  return (
    <div>
      {/* Kid selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {kids.map(ki => (
          <button key={ki.id} onClick={() => switchKid(ki.id)} style={S.kidBtn(kidId === ki.id, ki.color)}>
            {ki.label} · {ki.shortName}
          </button>
        ))}
      </div>

      {notAvailable ? (
        <div style={{ ...S.card({ borderColor: `${selectedKid?.color || "#A855F7"}33`, background: `${selectedKid?.color || "#A855F7"}0a` }), textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, color: selectedKid?.color || "#a855f7", fontWeight: 600, marginBottom: 6 }}>{t.statsNotAvailable}</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {t.statsNotAvailableDesc(selectedKid?.label, selectedKid?.shortName)}
          </div>
          {selectedKid?.fcbqId && (
            <a href={`https://www.basquetcatala.cat/equip/${selectedKid.fcbqId}`} target="_blank" rel="noreferrer"
              style={{ ...S.mapsBtn, marginTop: 14, display: "inline-flex", color: selectedKid.color, borderColor: `${selectedKid.color}4d`, background: `${selectedKid.color}1a` }}>
              {t.viewOnFcbq}
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Sub-tab toggle — box/log appear only once stats confirmed via API */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#111827", borderRadius: 10, padding: 4 }}>
            {subTabs.map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, background: view === id ? "#FF6B2B" : "transparent",
                border: "none", borderRadius: 7, padding: "7px 0",
                color: view === id ? "white" : "#475569", fontSize: 12, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          {view === "season" && <SeasonStats teamId={selectedKid.statsTeamId} kidName={selectedKid.name} onResult={setStatsConfirmed} />}
          {view === "box"    && <MatchBoxScores kidMatches={selectedMatches} kidName={selectedKid.name} />}
          {view === "log"    && <PlayerGameLog kidMatches={selectedMatches} kidName={selectedKid.name} />}
        </>
      )}
    </div>
  );
}
