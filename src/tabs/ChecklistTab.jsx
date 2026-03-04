import { useState } from "react";
import { S } from "../styles";
import { KIDS, K1_MATCHES, K2_MATCHES, CHECKLIST_STD, CHECKLIST_ROAD } from "../data";
import { upcoming, tier, fmtDate, leaveByFromMins, travelMins, getOverrideMins, mapsUrl } from "../utils";

const MATCHES_BY_KID = { k1: K1_MATCHES, k2: K2_MATCHES };

export default function ChecklistTab() {
  const [kidId, setKidId] = useState("k1");
  const [selIdx, setSelIdx] = useState(0);
  const [checked, setChecked] = useState({});

  const kid = KIDS.find(k => k.id === kidId);
  const upMatches = upcoming(MATCHES_BY_KID[kidId]);
  const match = upMatches[selIdx] || upMatches[0];

  // Reset match index when kid changes
  const switchKid = (id) => { setKidId(id); setSelIdx(0); };

  if (!match) return (
    <div style={{ color: "#475569", padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
      No upcoming matches for {kid.name}.
    </div>
  );

  const isRoad = tier(match.km) === "road";
  const items = isRoad ? CHECKLIST_ROAD : CHECKLIST_STD;
  const kit = match.ha === "home" ? kid.kit.home : kid.kit.away;
  const ck = `${kidId}-${selIdx}`;
  const done = items.filter(i => checked[`${ck}-${i.id}`]).length;

  const overrideMins = match.km > 0 ? getOverrideMins(match.venue, match.city) : null;
  const leave = match.km > 0 ? leaveByFromMins(match.time, overrideMins ?? travelMins(match.km), kid.arrivalBuffer) : null;

  const toggle = (id) => setChecked(c => ({ ...c, [`${ck}-${id}`]: !c[`${ck}-${id}`] }));
  const reset = () => {
    const next = {};
    Object.keys(checked).forEach(k => { if (!k.startsWith(`${ck}-`)) next[k] = checked[k]; });
    setChecked(next);
  };

  return (
    <div>
      <div style={S.sectionTitle}>Match Prep</div>

      {/* Kid selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {KIDS.map(ki => (
          <button key={ki.id} onClick={() => switchKid(ki.id)} style={S.kidBtn(kidId === ki.id, ki.color)}>
            {ki.label} · {ki.shortName}
          </button>
        ))}
      </div>

      {/* Match selector */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {upMatches.slice(0, 6).map((m, i) => (
          <button key={i} onClick={() => setSelIdx(i)} style={{
            background: i === selIdx ? kid.color : "#111827",
            border: `1px solid ${i === selIdx ? kid.color : "rgba(255,255,255,0.07)"}`,
            borderRadius: 8, padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap",
            color: i === selIdx ? "white" : "#64748b", fontSize: 12, fontWeight: 500,
          }}>
            {fmtDate(m.date)}
          </button>
        ))}
      </div>

      {/* Logistics summary card */}
      <div style={S.heroCard}>
        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 64, opacity: 0.07, pointerEvents: "none" }}>🏀</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={S.badge(match.ha === "home" ? "home" : isRoad ? "road" : "away")}>
            {match.ha === "home" ? "🏠 Home" : isRoad ? "🚗 Road Trip" : "✈ Away"}
          </span>
          <span style={S.badge(kidId === "k1" ? "k1" : "k2")}>{kid.label}</span>
          {match.canvis && <span style={S.badge("canvis")}>⚠ Canvis</span>}
        </div>
        <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>{fmtDate(match.date)}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginTop: 2 }}>
          {match.ha === "home" ? "vs" : "@"} {match.opp}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{match.venue} · {match.city}</div>
        <div style={S.divider} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={S.label}>Kickoff</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700 }}>{match.time}</div>
          </div>
          {leave && (
            <div>
              <div style={S.label}>Leave by</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: kid.color }}>{leave}</div>
            </div>
          )}
          <div>
            <div style={S.label}>Kit</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{kit.jersey}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>+ {kit.shorts} shorts</div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...S.sectionTitle, marginBottom: 0 }}>
          Kit Checklist {isRoad && <span style={{ color: "#ffb347", fontSize: 13 }}>🚗 Road</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: done === items.length ? "#22d3a0" : "#64748b" }}>
            {done}/{items.length}
          </span>
          <button onClick={reset} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>Reset</button>
        </div>
      </div>

      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        {items.map((item, i) => {
          const isChecked = !!checked[`${ck}-${item.id}`];
          return (
            <div key={item.id}>
              {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 12px" }} />}
              <div style={S.checkItem(isChecked)} onClick={() => toggle(item.id)}>
                <div style={S.checkBox(isChecked)}>{isChecked && "✓"}</div>
                <span style={{ fontSize: 16 }}>{item.emoji}</span>
                <span style={{ fontSize: 14, color: isChecked ? "#64748b" : "#e2e8f0", textDecoration: isChecked ? "line-through" : "none" }}>
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {done === items.length && (
        <div style={{ background: "rgba(34,211,160,0.1)", border: "1px solid rgba(34,211,160,0.25)", borderRadius: 10, padding: 14, marginTop: 12, textAlign: "center" }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ color: "#22d3a0", fontWeight: 600, marginLeft: 8 }}>Kit ready. Let's go.</span>
        </div>
      )}

      {match.ha === "away" && (
        <a href={mapsUrl(match.venue, match.city)} target="_blank" rel="noreferrer"
          style={{ ...S.mapsBtn, marginTop: 12, width: "100%", justifyContent: "center", textDecoration: "none", display: "flex", borderColor: `${kid.color}44`, color: kid.color, background: `${kid.color}1a` }}>
          📍 Open {match.venue} in Maps
        </a>
      )}
    </div>
  );
}
