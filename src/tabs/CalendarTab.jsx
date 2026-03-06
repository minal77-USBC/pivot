import { useState } from "react";
import { S } from "../styles";
import { upcoming, tier, fmtDate, daysLabel, daysOut, leaveByFromMins, travelMins, getOverrideMins } from "../utils";
import { useLang } from "../LangContext";

export default function CalendarTab({ kids = [], k1Matches, k2Matches }) {
  const { t } = useLang();
  const [filter, setFilter] = useState("all");

  // Merge upcoming matches from both kids, tagged with kidId
  const allUpcoming = [
    ...upcoming(k1Matches).map(m => ({ ...m, kidId: "k1" })),
    ...upcoming(k2Matches).map(m => ({ ...m, kidId: "k2" })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const filtered = filter === "all" ? allUpcoming : allUpcoming.filter(m => m.kidId === filter);

  // Group by date
  const dates = [];
  const byDate = {};
  for (const m of filtered) {
    if (!byDate[m.date]) { byDate[m.date] = []; dates.push(m.date); }
    byDate[m.date].push(m);
  }

  // Count double-header dates (both kids play same day)
  const k1Dates = new Set(upcoming(k1Matches).map(m => m.date));
  const k2Dates = new Set(upcoming(k2Matches).map(m => m.date));
  const doubleDates = new Set([...k1Dates].filter(d => k2Dates.has(d)));

  // Road trip view: all away matches across both kids, split upcoming / past
  const allAway = [
    ...(k1Matches || []).map(m => ({ ...m, kidId: "k1" })),
    ...(k2Matches || []).map(m => ({ ...m, kidId: "k2" })),
  ].filter(m => m.ha === "away");
  const upcomingAway = allAway
    .filter(m => daysOut(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const pastAway = allAway
    .filter(m => daysOut(m.date) < 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          ["all",  t.filterBoth,  "#64748b"],
          ["k1", kids[0]?.label || "Kid 1", kids[0]?.color || "#FF6B2B"],
          ["k2", kids[1]?.label || "Kid 2", kids[1]?.color || "#A855F7"],
          ["away", t.filterAway, "#ffb347"],
        ].map(([id, label, color]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{
              background: filter === id ? color : "transparent",
              border: `1px solid ${filter === id ? color : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20, padding: "5px 14px", cursor: "pointer",
              color: filter === id ? (id === "away" ? "#1a1a1a" : "white") : "#64748b",
              fontSize: 12, fontWeight: 500, transition: "all 0.15s",
            }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#334155", alignSelf: "center" }}>
          {filter === "away" ? t.roadTrips(allAway.length) : t.matchCount(filtered.length)}
        </span>
      </div>

      {/* Road trip view */}
      {filter === "away" && (
        <div>
          {upcomingAway.length === 0 && pastAway.length === 0 && (
            <div style={{ ...S.card(), color: "#64748b", textAlign: "center", padding: 28 }}>
              {t.noAwayMatches}
            </div>
          )}
          {upcomingAway.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#ffb347", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                {t.upcoming} · {upcomingAway.length}
              </div>
              {upcomingAway.map((m, i) => <MatchRow key={i} m={m} kids={kids} />)}
            </>
          )}
          {upcomingAway.length > 0 && pastAway.length > 0 && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "16px 0" }} />
          )}
          {pastAway.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                {t.played} · {pastAway.length}
              </div>
              {pastAway.map((m, i) => <MatchRow key={i} m={m} kids={kids} past />)}
            </>
          )}
        </div>
      )}

      {/* Standard timeline */}
      {filter !== "away" && dates.length === 0 && (
        <div style={{ ...S.card(), color: "#64748b", textAlign: "center", padding: 28 }}>
          {t.seasonComplete}
        </div>
      )}

      {filter !== "away" && dates.map(date => {
        const matches = byDate[date];
        const isDouble = doubleDates.has(date) && filter === "all";
        const n = daysOut(date);
        const days = daysLabel(date);

        return (
          <div key={date} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {fmtDate(date)}
              </span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: n <= 1 ? 14 : 12,
                fontWeight: n <= 1 ? 700 : 500,
                letterSpacing: "0.04em",
                color: n === 0 ? "#FF6B2B" : n === 1 ? "#22d3a0" : "#475569",
              }}>{days}</span>
              {isDouble && (
                <span style={{ ...S.badge("canvis"), marginLeft: 2 }}>{t.bothBadge}</span>
              )}
            </div>
            {matches.map((m, i) => <MatchRow key={i} m={m} kids={kids} />)}
          </div>
        );
      })}
    </div>
  );
}

function MatchRow({ m, kids, past = false }) {
  const { t } = useLang();
  const kid = kids.find(k => k.id === m.kidId);
  const overrideMins = m.km > 0 ? getOverrideMins(m.venue, m.city) : null;
  const leave = m.km > 0
    ? leaveByFromMins(m.time, overrideMins ?? travelMins(m.km), kid.arrivalBuffer)
    : null;
  const tierLevel = tier(m.km);
  const haLabel = m.ha === "home" ? t.haHome : tierLevel === "road" ? t.haRoad(m.city) : t.haAway(m.city);

  return (
    <div style={{
      background: "#0f172a",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${past ? "#334155" : kid.color}`,
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 6,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      opacity: past ? 0.6 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: past ? "#475569" : kid.color }}>{kid.label}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(m.date)}</span>
          <span style={S.badge(m.ha === "home" ? "home" : tierLevel === "road" ? "road" : "away")}>
            {haLabel}
          </span>
          {m.canvis && <span style={S.badge("canvis")}>⚠ Canvis</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: past ? "#64748b" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @ {m.opp}
        </div>
        {!past && leave && (
          <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
            {t.leaveby} <span style={{ color: kid.color, fontWeight: 600 }}>{leave}</span>
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: past ? "#475569" : "#f1f5f9", lineHeight: 1 }}>
          {m.time}
        </div>
        {m.km > 0 && (
          <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>~{travelMins(m.km)}min · {m.km}km</div>
        )}
      </div>
    </div>
  );
}
