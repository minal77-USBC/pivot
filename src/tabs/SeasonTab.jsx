import { useState } from "react";
import { S } from "../styles";
import { fmtDate } from "../utils";
import { useLang } from "../LangContext";

export default function SeasonTab({ kids = [], k1Matches, k2Matches, k3Matches }) {
  const [kidId, setKidId] = useState("k1");

  return (
    <div>
      {/* Kid selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {kids.map(ki => (
          <button key={ki.id} onClick={() => setKidId(ki.id)} style={S.kidBtn(kidId === ki.id, ki.color)}>
            {ki.label} · {ki.shortName}
          </button>
        ))}
      </div>

      {(() => {
        const idx = kids.findIndex(k => k.id === kidId);
        const matchesById = {
          [kids[0]?.id]: k1Matches,
          [kids[1]?.id]: k2Matches,
          [kids[2]?.id]: k3Matches,
        };
        const matches = matchesById[kidId] || k1Matches;
        const kid = kids[idx] || kids[0];
        return <KidSeason matches={matches} kid={kid} />;
      })()}
    </div>
  );
}

function KidSeason({ matches, kid }) {
  const { t } = useLang();
  const played = matches.filter(m => m.played);
  const wins = played.filter(m => m.win).length;
  const losses = played.length - wins;
  const homeGames = played.filter(m => m.ha === "home");
  const awayGames = played.filter(m => m.ha === "away");
  const homeWins = homeGames.filter(m => m.win).length;
  const awayWins = awayGames.filter(m => m.win).length;
  const roadTrips = matches.filter(m => m.ha === "away");
  const roadDone = roadTrips.filter(m => m.played).length;
  const roadUpcoming = roadTrips.filter(m => !m.played).sort((a, b) => a.date.localeCompare(b.date));
  const roadPlayed = roadTrips.filter(m => m.played).sort((a, b) => b.date.localeCompare(a.date));
  const winPct = played.length ? Math.round((wins / played.length) * 100) : 0;

  const streak = (() => {
    const recent = [...played].reverse();
    if (!recent.length) return { count: 0, win: true };
    let count = 0;
    const type = recent[0].win;
    for (const m of recent) { if (m.win === type) count++; else break; }
    return { count, win: type };
  })();

  return (
    <>
      <div style={S.sectionTitle}>{kid?.label} — {kid?.shortName} {t.season}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#22d3a0" }}>{wins}</div><div style={S.statLbl}>{t.wins}</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#ff4757" }}>{losses}</div><div style={S.statLbl}>{t.losses}</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: kid?.color || "#FF6B2B" }}>{winPct}%</div><div style={S.statLbl}>{t.winRate}</div></div>
      </div>

      <div style={{ ...S.card(), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={S.label}>{t.currentStreak}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: streak.win ? "#22d3a0" : "#ff4757" }}>
            {streak.win ? t.winsRow(streak.count) : t.lossesRow(streak.count)}
          </div>
        </div>
        <div style={{ fontSize: 28 }}>{streak.win ? "🔥" : "❄️"}</div>
      </div>

      <div style={S.sectionTitle}>{t.homeAwaySplit}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#22d3a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{t.homeLabel}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{homeWins}{t.wLabel} / {homeGames.length - homeWins}{t.lLabel}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{homeGames.length ? Math.round(homeWins / homeGames.length * 100) : 0}% {t.winRateShort}</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#ff4757", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{t.awayLabel}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{awayWins}{t.wLabel} / {awayGames.length - awayWins}{t.lLabel}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{awayGames.length ? Math.round(awayWins / awayGames.length * 100) : 0}% {t.winRateShort}</div>
        </div>
      </div>

      <div style={S.sectionTitle}>{t.roadTripsTitle}</div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
        {t.roadTripsSummary(roadDone, roadTrips.length - roadDone)}
      </div>

      {roadUpcoming.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#ffb347", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            {t.upcoming} · {roadUpcoming.length}
          </div>
          <div style={{ ...S.card(), marginBottom: 12 }}>
            {roadUpcoming.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < roadUpcoming.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>{m.opp}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(m.date)} · {m.city}{m.km > 0 ? ` · ${m.km}km` : ""}</div>
                </div>
                <span style={S.badge("road")}>{t.upcomingBadge}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {roadPlayed.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            {t.played} · {roadPlayed.length}
          </div>
          <div style={S.card()}>
            {roadPlayed.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < roadPlayed.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", opacity: 0.7 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>{m.opp}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(m.date)} · {m.city}{m.km > 0 ? ` · ${m.km}km` : ""}</div>
                </div>
                <span style={{ fontSize: 13, color: m.win ? "#22d3a0" : "#ff4757", fontWeight: 600 }}>{m.win ? t.wLabel : t.lLabel} {m.score}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={S.sectionTitle}>{t.recentForm}</div>
      <div style={{ ...S.card(), display: "flex", gap: 6, flexWrap: "wrap" }}>
        {played.slice(-10).map((m, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: 8,
            background: m.win ? "rgba(34,211,160,0.15)" : "rgba(255,71,87,0.15)",
            border: `1px solid ${m.win ? "rgba(34,211,160,0.3)" : "rgba(255,71,87,0.3)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757",
          }}>
            {m.win ? t.wLabel : t.lLabel}
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#475569", alignSelf: "center", marginLeft: 4 }}>{t.last10}</div>
      </div>

      <div style={S.sectionTitle}>{t.allResults}</div>
      <div style={S.card()}>
        {played.slice().reverse().map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < played.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(m.date)}</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>{m.ha === "home" ? "vs" : "@"} {m.opp}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757" }}>
              {m.win ? t.wLabel : t.lLabel} {m.score}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
