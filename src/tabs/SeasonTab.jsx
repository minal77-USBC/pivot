import { useState } from "react";
import { S } from "../styles";
import { KIDS, K1_MATCHES, K2_MATCHES } from "../data";
import { tier, fmtDate, leaveByFromMins, travelMins, getOverrideMins } from "../utils";

export default function SeasonTab() {
  const [kidId, setKidId] = useState("k1");
  const kid = KIDS.find(k => k.id === kidId);

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

      {kidId === "k1" ? <RohanSeason /> : <SaraSeason />}
    </div>
  );
}

function RohanSeason() {
  const played = K1_MATCHES.filter(m => m.played);
  const wins = played.filter(m => m.win).length;
  const losses = played.length - wins;
  const homeGames = played.filter(m => m.ha === "home");
  const awayGames = played.filter(m => m.ha === "away");
  const homeWins = homeGames.filter(m => m.win).length;
  const awayWins = awayGames.filter(m => m.win).length;
  const roadTrips = K1_MATCHES.filter(m => tier(m.km) === "road");
  const roadDone = roadTrips.filter(m => m.played).length;
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
      <div style={S.sectionTitle}>Rohan — Cadet Masculí Season</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#22d3a0" }}>{wins}</div><div style={S.statLbl}>Wins</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#ff4757" }}>{losses}</div><div style={S.statLbl}>Losses</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#FF6B2B" }}>{winPct}%</div><div style={S.statLbl}>Win Rate</div></div>
      </div>

      <div style={{ ...S.card(), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={S.label}>Current Streak</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: streak.win ? "#22d3a0" : "#ff4757" }}>
            {streak.count} {streak.win ? "wins" : "losses"} in a row
          </div>
        </div>
        <div style={{ fontSize: 28 }}>{streak.win ? "🔥" : "❄️"}</div>
      </div>

      <div style={S.sectionTitle}>Home / Away Split</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#22d3a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>🏠 Home</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{homeWins}W / {homeGames.length - homeWins}L</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{homeGames.length ? Math.round(homeWins / homeGames.length * 100) : 0}% win rate</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#ff4757", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>✈ Away</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{awayWins}W / {awayGames.length - awayWins}L</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{awayGames.length ? Math.round(awayWins / awayGames.length * 100) : 0}% win rate</div>
        </div>
      </div>

      <div style={S.sectionTitle}>Road Trips</div>
      <div style={S.card()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>{roadDone} completed · {roadTrips.length - roadDone} remaining</span>
        </div>
        {roadTrips.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < roadTrips.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: m.played ? "#475569" : "#f1f5f9", textDecoration: m.played ? "line-through" : "none" }}>
                {m.city}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(m.date)} · {m.km}km</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {m.played
                ? <span style={{ fontSize: 13, color: m.win ? "#22d3a0" : "#ff4757", fontWeight: 600 }}>{m.win ? "W" : "L"} {m.score}</span>
                : <span style={S.badge("road")}>Upcoming</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={S.sectionTitle}>Recent Form</div>
      <div style={{ ...S.card(), display: "flex", gap: 6, flexWrap: "wrap" }}>
        {played.slice(-10).map((m, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: 8,
            background: m.win ? "rgba(34,211,160,0.15)" : "rgba(255,71,87,0.15)",
            border: `1px solid ${m.win ? "rgba(34,211,160,0.3)" : "rgba(255,71,87,0.3)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757",
          }}>
            {m.win ? "W" : "L"}
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#475569", alignSelf: "center", marginLeft: 4 }}>Last 10</div>
      </div>

      <div style={S.sectionTitle}>All Results</div>
      <div style={S.card()}>
        {played.slice().reverse().map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < played.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(m.date)}</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>{m.ha === "home" ? "vs" : "@"} {m.opp}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757" }}>
              {m.win ? "W" : "L"} {m.score}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function SaraSeason() {
  const played = K2_MATCHES.filter(m => m.played);
  const wins = played.filter(m => m.win).length;
  const losses = played.length - wins;
  const homeGames = played.filter(m => m.ha === "home");
  const awayGames = played.filter(m => m.ha === "away");
  const homeWins = homeGames.filter(m => m.win).length;
  const awayWins = awayGames.filter(m => m.win).length;
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
      <div style={S.sectionTitle}>Sara — Infantil Femení Season</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#22d3a0" }}>{wins}</div><div style={S.statLbl}>Wins</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#ff4757" }}>{losses}</div><div style={S.statLbl}>Losses</div></div>
        <div style={S.statBox}><div style={{ ...S.statNum, color: "#a855f7" }}>{winPct}%</div><div style={S.statLbl}>Win Rate</div></div>
      </div>

      <div style={{ ...S.card(), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={S.label}>Current Streak</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: streak.win ? "#22d3a0" : "#ff4757" }}>
            {streak.count} {streak.win ? "wins" : "losses"} in a row
          </div>
        </div>
        <div style={{ fontSize: 28 }}>{streak.win ? "🔥" : "❄️"}</div>
      </div>

      <div style={S.sectionTitle}>Home / Away Split</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#22d3a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>🏠 Home</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{homeWins}W / {homeGames.length - homeWins}L</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{homeGames.length ? Math.round(homeWins / homeGames.length * 100) : 0}% win rate</div>
        </div>
        <div style={S.statBox}>
          <div style={{ fontSize: 11, color: "#ff4757", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>✈ Away</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>{awayWins}W / {awayGames.length - awayWins}L</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{awayGames.length ? Math.round(awayWins / awayGames.length * 100) : 0}% win rate</div>
        </div>
      </div>

      <div style={S.sectionTitle}>Recent Form</div>
      <div style={{ ...S.card(), display: "flex", gap: 6, flexWrap: "wrap" }}>
        {played.slice(-10).map((m, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: 8,
            background: m.win ? "rgba(34,211,160,0.15)" : "rgba(255,71,87,0.15)",
            border: `1px solid ${m.win ? "rgba(34,211,160,0.3)" : "rgba(255,71,87,0.3)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757",
          }}>
            {m.win ? "W" : "L"}
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#475569", alignSelf: "center", marginLeft: 4 }}>Last 10</div>
      </div>

      <div style={S.sectionTitle}>All Results</div>
      <div style={S.card()}>
        {K2_MATCHES.slice().reverse().map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < K2_MATCHES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(m.date)}</div>
              <div style={{ fontSize: 13, color: m.played ? "#94a3b8" : "#475569" }}>{m.ha === "home" ? "vs" : "@"} {m.opp}</div>
            </div>
            {m.played
              ? <span style={{ fontSize: 14, fontWeight: 700, color: m.win ? "#22d3a0" : "#ff4757" }}>
                  {m.win ? "W" : "L"} {m.score}
                </span>
              : <span style={S.badge("canvis")}>Upcoming</span>}
          </div>
        ))}
      </div>
    </>
  );
}
