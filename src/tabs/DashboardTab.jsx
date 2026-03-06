import { useState } from "react";
import MatchCard from "../components/MatchCard";
import { S } from "../styles";
import { upcoming, daysOut, fmtDate, leaveByFromMins, travelMins, getOverrideMins } from "../utils";
import { useLang } from "../LangContext";

function getLeave(m, arrivalBuffer = 20) {
  if (m.km === 0) return null;
  const override = getOverrideMins(m.venue, m.city);
  return leaveByFromMins(m.time, override ?? travelMins(m.km), arrivalBuffer);
}

export default function DashboardTab({ kids = [], k1Matches, k2Matches }) {
  const { t } = useLang();
  const [briefing, setBriefing] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [copied, setCopied] = useState(false);

  const upK1 = upcoming(k1Matches);
  const upK2 = upcoming(k2Matches);
  const nextK1 = upK1[0];
  const nextK2 = upK2[0];

  const allMatches = [k1Matches, k2Matches];
  const doubles = upK1.filter(m1 => upK2.some(m2 => m2.date === m1.date));

  const showBriefBtn = (nextK1 && daysOut(nextK1.date) <= 4) || (nextK2 && daysOut(nextK2.date) <= 4);

  const generateBriefing = async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBriefing(null);

    const matchLines = [];
    if (nextK1 && daysOut(nextK1.date) <= 4) {
      const k1 = kids[0];
      const leave = getLeave(nextK1, k1?.arrivalBuffer);
      matchLines.push(
        `${k1?.name || "Kid 1"} (${k1?.category || ""}, ${k1?.shortName || ""}): ${fmtDate(nextK1.date)}, ${nextK1.time}, ${nextK1.ha === "home" ? "HOME" : "AWAY"} vs ${nextK1.opp}, ${nextK1.venue}, ${nextK1.city}, ${nextK1.km}km away${leave ? `, leave by ${leave}` : ""}, kit: ${nextK1.ha === "home" ? "NEGRE/VERMELL" : "BLANCA/VERMELL"}`
      );
    } else {
      matchLines.push(`${kids[0]?.label || "Kid 1"}: No match this weekend.`);
    }
    if (nextK2 && daysOut(nextK2.date) <= 4) {
      const k2 = kids[1];
      const leave = getLeave(nextK2, k2?.arrivalBuffer);
      matchLines.push(
        `${k2?.name || "Kid 2"} (${k2?.category || ""}, ${k2?.shortName || ""}): ${fmtDate(nextK2.date)}, ${nextK2.time}, ${nextK2.ha === "home" ? "HOME" : "AWAY"} vs ${nextK2.opp}, ${nextK2.venue}, ${nextK2.city}, ${nextK2.km}km away${leave ? `, leave by ${leave}` : ""}, kit: ${nextK2.ha === "home" ? "NEGRE/VERMELL" : "BLANCA/VERMELL"}`
      );
    } else {
      matchLines.push(`${kids[1]?.label || "Kid 2"}: No match this weekend.`);
    }

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
      {/* Weekend alert */}
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
      {doubles.length > 0 && (
        <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#a855f7", marginBottom: 4 }}>{t.doubleMatchDay(fmtDate(doubles[0].date))}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {kids[0]?.label} · {doubles[0].time} &nbsp;·&nbsp; {kids[1]?.label} · {upK2.find(m => m.date === doubles[0].date)?.time}
          </div>
        </div>
      )}

      {/* Season stats — one row per kid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {kids.map((kid, idx) => {
          const matches = allMatches[idx] || [];
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

      {/* Next matches */}
      {nextK1 && (
        <>
          <div style={S.sectionTitle}>{kids[0]?.label || "Kid 1"} — {t.nextMatch}</div>
          <MatchCard m={nextK1} kidColor={kids[0]?.color} arrivalBuffer={kids[0]?.arrivalBuffer} />
        </>
      )}
      {nextK2 && (
        <>
          <div style={S.sectionTitle}>{kids[1]?.label || "Kid 2"} — {t.nextMatch}</div>
          <MatchCard m={nextK2} kidColor={kids[1]?.color} arrivalBuffer={kids[1]?.arrivalBuffer} />
        </>
      )}

      {/* Upcoming road trips */}
      {upK1.filter(m => m.km > 60).length > 0 && (
        <>
          <div style={S.sectionTitle}>{t.upcomingRoadTrips}</div>
          {upK1.filter(m => m.km > 60).slice(0, 3).map((m, i) => {
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
