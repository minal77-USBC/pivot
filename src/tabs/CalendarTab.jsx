import { useState } from "react";
import { S } from "../styles";
import { KIDS } from "../data";
import { upcoming, tier, fmtDate, daysLabel, leaveByFromMins, travelMins, getOverrideMins } from "../utils";

export default function CalendarTab({ k1Matches, k2Matches }) {
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

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          ["all",  "Both",  "#64748b"],
          ["k1",   "Rohan", KIDS[0].color],
          ["k2",   "Sara",  KIDS[1].color],
        ].map(([id, label, color]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{
              background: filter === id ? color : "transparent",
              border: `1px solid ${filter === id ? color : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20, padding: "5px 14px", cursor: "pointer",
              color: filter === id ? "white" : "#64748b",
              fontSize: 12, fontWeight: 500, transition: "all 0.15s",
            }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#334155", alignSelf: "center" }}>
          {filtered.length} matches
        </span>
      </div>

      {/* Timeline */}
      {dates.length === 0 && (
        <div style={{ ...S.card(), color: "#64748b", textAlign: "center", padding: 28 }}>
          Season complete 🏆
        </div>
      )}

      {dates.map(date => {
        const matches = byDate[date];
        const isDouble = doubleDates.has(date) && filter === "all";
        const days = daysLabel(date);

        return (
          <div key={date} style={{ marginBottom: 14 }}>
            {/* Date header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {fmtDate(date)}
              </span>
              <span style={{ fontSize: 11, color: "#334155" }}>{days}</span>
              {isDouble && (
                <span style={{ ...S.badge("canvis"), marginLeft: 2 }}>⚡ Both</span>
              )}
            </div>

            {/* Match rows */}
            {matches.map((m, i) => {
              const kid = KIDS.find(k => k.id === m.kidId);
              const overrideMins = m.km > 0 ? getOverrideMins(m.venue, m.city) : null;
              const leave = m.km > 0
                ? leaveByFromMins(m.time, overrideMins ?? travelMins(m.km), kid.arrivalBuffer)
                : null;
              const t = tier(m.km);
              const haLabel = m.ha === "home" ? "🏠 Home" : t === "road" ? `🚗 ${m.city}` : `✈ ${m.city}`;

              return (
                <div key={i} style={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${kid.color}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: kid.color }}>{kid.label}</span>
                      <span style={S.badge(m.ha === "home" ? "home" : t === "road" ? "road" : "away")}>
                        {haLabel}
                      </span>
                      {m.canvis && <span style={S.badge("canvis")}>⚠ Canvis</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.ha === "home" ? "vs" : "@"} {m.opp}
                    </div>
                    {leave && (
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                        leave by <span style={{ color: kid.color, fontWeight: 600 }}>{leave}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>
                      {m.time}
                    </div>
                    {m.km > 0 && (
                      <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>~{travelMins(m.km)}min · {m.km}km</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
