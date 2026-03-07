import { useState } from "react";
import MatchCard from "../components/MatchCard";
import ScoutCard from "../components/ScoutCard";
import { S } from "../styles";
import { upcoming, daysOut, fmtDate, leaveByFromMins, travelMins, getOverrideMins } from "../utils";
import { useLang } from "../LangContext";

function getLeave(m, arrivalBuffer = 20) {
  if (m.km === 0) return null;
  const override = getOverrideMins(m.venue, m.city);
  return leaveByFromMins(m.time, override ?? travelMins(m.km), arrivalBuffer);
}

export default function DashboardTab({ kids = [], k1Matches, k2Matches, k3Matches = [] }) {
  const { t } = useLang();
  const [briefing, setBriefing] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [copied, setCopied] = useState(false);

  const allMatchesList = [k1Matches, k2Matches, k3Matches];
  const upcomingPerKid = allMatchesList.map(upcoming);
  const nextPerKid = upcomingPerKid.map(u => u[0]);

  // Double-header: any date where ≥2 kids play
  const allUpcomingDates = upcomingPerKid.flatMap(u => u.map(m => m.date));
  const dateCounts = allUpcomingDates.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {});
  const doubleDates = Object.keys(dateCounts).filter(d => dateCounts[d] >= 2).sort();
  const firstDouble = doubleDates[0];

  const nextK1 = nextPerKid[0];
  const showBriefBtn = nextPerKid.some(m => m && daysOut(m.date) <= 4);

  const generateBriefing = async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBriefing(null);

    const matchLines = kids.map((kid, idx) => {
      const m = nextPerKid[idx];
      if (!m || daysOut(m.date) > 4) return `${kid.label}: No match this weekend.`;
      const leave = getLeave(m, kid.arrivalBuffer);
      return `${kid.name} (${kid.category}, ${kid.shortName}): ${fmtDate(m.date)}, ${m.time}, ${m.ha === "home" ? "HOME" : "AWAY"} vs ${m.opp}, ${m.venue}, ${m.city}, ${m.km}km away${leave ? `, leave by ${leave}` : ""}, kit: ${m.ha === "home" ? "NEGRE/VERMELL" : "BLANCA/VERMELL"}`;
    });

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: matchLines.join("\n") }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setBriefing(data.text);
    } catch (e) {
      setBriefError(e.message);
    } finally {
      setBriefLoading(false);
    }
  };

  const copyBriefing = () => {
    navigator.clipboard.writeText(briefing);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Weekend alert — based on first kid's next match */}
      {nextK1 && daysOut(nextK1.date) <= 3 && (
        <div style={{ background: "rgba(255,107,43,0.08)", border: "1px solid rgba(255,107,43,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#FF6B2B" }}>{t.matchThisWeekend}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(nextK1.date)} · {nextK1.time} · {nextK1.ha === "home" ? nextK1.venue : nextK1.city}</div>
          </div>
        </div>
      )}

      {/* Double-header alert */}
      {firstDouble && (
        <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#a855f7", marginBottom: 4 }}>{t.doubleMatchDay(fmtDate(firstDouble))}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {kids.map((kid, idx) => {
              const m = upcomingPerKid[idx].find(m => m.date === firstDouble);
              return m ? `${kid.label} · ${m.time}` : null;
            }).filter(Boolean).join("  ·  ")}
          </div>
        </div>
      )}

      {/* Season stats — one row per kid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {kids.map((kid, idx) => {
          const matches = allMatchesList[idx] || [];
          const played = matches.filter(m => m.played);
          const wins = played.filter(m => m.win).length;
          return (
            <div key={kid.id} style={{ display: "flex", gap: 8 }}>
              <div style={{ ...S.statBox, flex: 1 }}>
                <div style={{ ...S.statNum, color: "#22d3a0", fontSize: 24 }}>{wins}{t.wLabel}</div>
                <div style={S.statLbl}>{kid.label}</div>
              </div>
              <div style={{ ...S.statBox, flex: 1 }}>
                <div style={{ ...S.statNum, color: "#ff4757", fontSize: 24 }}>{played.length - wins}{t.lLabel}</div>
                <div style={S.statLbl}>{kid.shortName}</div>
              </div>
              <div style={{ ...S.statBox, flex: 1 }}>
                <div style={{ ...S.statNum, color: "#64748b", fontSize: 24 }}>{matches.filter(m => !m.played).length}</div>
                <div style={S.statLbl}>{t.left}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next match + scout card per kid */}
      {kids.map((kid, idx) => {
        const next = nextPerKid[idx];
        if (!next) return null;
        return (
          <div key={kid.id}>
            <div style={S.sectionTitle}>{kid.label} — {t.nextMatch}</div>
            <MatchCard m={next} kidColor={kid.color} arrivalBuffer={kid.arrivalBuffer} />
            {kid.statsAvailable && next.oppTeamId && (
              <ScoutCard match={next} kid={kid} />
            )}
          </div>
        );
      })}

      {/* Upcoming road trips (k1 only — Cadet Preferent has the long trips) */}
      {upcomingPerKid[0].filter(m => m.km > 60).length > 0 && (
        <>
          <div style={S.sectionTitle}>{t.upcomingRoadTrips}</div>
          {upcomingPerKid[0].filter(m => m.km > 60).slice(0, 3).map((m, i) => {
            const leave = getLeave(m, kids[0]?.arrivalBuffer);
            return (
              <div key={i} style={{ ...S.roadCard, padding: "12px 14px" }}>
                <div style={S.spaceBetween}>
                  <div>
                    <div style={{ fontSize: 12, color: "#ffb347", fontWeight: 600 }}>🚗 {m.city} · {m.km}km</div>
                    <div style={{ fontSize: 14, color: "#f1f5f9", marginTop: 2 }}>vs {m.opp}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(m.date)}</div>
                    {leave && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: "#FF6B2B" }}>{leave}</div>}
                    <div style={{ fontSize: 10, color: "#475569" }}>{t.leaveBy}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Thursday Briefing */}
      {showBriefBtn && (
        <>
          <div style={S.sectionTitle}>{t.thursdayBriefing}</div>
          {!briefing && !briefLoading && (
            <button style={S.primaryBtn} onClick={generateBriefing}>
              {t.generateBriefing}
            </button>
          )}
          {briefLoading && (
            <div style={{ ...S.card(), textAlign: "center", color: "#64748b", padding: 20 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
              {t.generating}
            </div>
          )}
          {briefError && (
            <div style={{ ...S.card({ borderColor: "rgba(255,71,87,0.3)" }), color: "#ff4757", fontSize: 13 }}>
              Error: {briefError}
              <button onClick={generateBriefing} style={{ marginLeft: 12, background: "none", border: "none", color: "#FF6B2B", cursor: "pointer", fontSize: 12 }}>{t.retry}</button>
            </div>
          )}
          {briefing && (
            <div style={{ ...S.card({ borderColor: "rgba(34,211,160,0.2)", background: "rgba(34,211,160,0.04)" }) }}>
              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6, marginBottom: 12 }}>{briefing}</div>
              <button onClick={copyBriefing} style={{ ...S.primaryBtn, background: copied ? "#22d3a0" : undefined }}>
                {copied ? t.copied : t.copyClipboard}
              </button>
              <button onClick={() => setBriefing(null)} style={{ marginTop: 8, background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, display: "block", width: "100%", textAlign: "center" }}>
                {t.regenerate}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
