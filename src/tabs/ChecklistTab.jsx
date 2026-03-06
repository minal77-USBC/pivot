import { useState } from "react";
import { S } from "../styles";
import { CHECKLIST_STD, CHECKLIST_ROAD, CHECKLIST_NIGHT_BEFORE } from "../data";
import { upcoming, tier, fmtDate, leaveByFromMins, travelMins, getOverrideMins, mapsUrl, latestMeal, daysOut } from "../utils";
import { useLang } from "../LangContext";

export default function ChecklistTab({ kids = [], k1Matches, k2Matches }) {
  const { t } = useLang();
  const [kidId, setKidId] = useState("k1");
  const [selIdx, setSelIdx] = useState(0);
  const [checked, setChecked] = useState({});

  const kid = kids.find(k => k.id === kidId);
  const upMatches = upcoming(kidId === "k1" ? k1Matches : k2Matches);
  const match = upMatches[selIdx] || upMatches[0];

  const switchKid = (id) => { setKidId(id); setSelIdx(0); };

  if (!match) return (
    <div style={{ color: "#475569", padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
      {t.noUpcoming(kid.name)}
    </div>
  );

  const isRoad = tier(match.km) === "road";
  const matchDayItems = isRoad ? CHECKLIST_ROAD : CHECKLIST_STD;
  const kit = match.ha === "home" ? kid.kit.home : kid.kit.away;
  const ck = `${kidId}-${selIdx}`;

  // Count checked items across both sections
  const nightDone = CHECKLIST_NIGHT_BEFORE.filter(i => checked[`${ck}-night-${i.id}`]).length;
  const dayDone = matchDayItems.filter(i => checked[`${ck}-day-${i.id}`]).length;

  const overrideMins = match.km > 0 ? getOverrideMins(match.venue, match.city) : null;
  const leave = match.km > 0
    ? leaveByFromMins(match.time, overrideMins ?? travelMins(match.km), kid.arrivalBuffer)
    : null;
  const meal = latestMeal(match.time, kid.arrivalBuffer);

  const daysAway = daysOut(match.date);
  const showNightBefore = daysAway >= 1; // only show if match is tomorrow or later

  const toggle = (section, id) =>
    setChecked(c => ({ ...c, [`${ck}-${section}-${id}`]: !c[`${ck}-${section}-${id}`] }));

  const reset = () => {
    const next = {};
    Object.keys(checked).forEach(k => { if (!k.startsWith(`${ck}-`)) next[k] = checked[k]; });
    setChecked(next);
  };

  return (
    <div>
      <div style={S.sectionTitle}>{t.matchPrep}</div>

      {/* Kid selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {kids.map(ki => (
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
            {match.ha === "home" ? t.haHome : isRoad ? t.haRoadTrip : t.haAway(match.city)}
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
            <div style={S.label}>{t.kickoff}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700 }}>{match.time}</div>
          </div>
          {leave && (
            <div>
              <div style={S.label}>{t.leaveBy}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: kid.color }}>{leave}</div>
            </div>
          )}
          {match.km > 0 && (
            <div>
              <div style={S.label}>{t.travel}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "#ffb347" }}>
                {overrideMins ? overrideMins : `~${travelMins(match.km)}`}<span style={{ fontSize: 14, fontWeight: 400 }}>{t.min}</span>
              </div>
              <div style={{ fontSize: 10, color: "#475569" }}>{match.km}km</div>
            </div>
          )}
          <div>
            <div style={S.label}>{t.latestMeal}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "#22d3a0" }}>{meal}</div>
          </div>
          <div>
            <div style={S.label}>{t.kit}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{kit.jersey}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>+ {kit.shorts} shorts</div>
          </div>
        </div>
        {match.ha === "away" && (
          <a href={mapsUrl(match.venue, match.city)} target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginTop: 14, padding: "10px 0", borderRadius: 8, textDecoration: "none",
              background: `${kid.color}18`, border: `1px solid ${kid.color}44`,
              color: kid.color, fontSize: 13, fontWeight: 600,
            }}>
            {t.openInMaps(match.venue)}
          </a>
        )}
      </div>

      {/* Night Before checklist */}
      {showNightBefore && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 6 }}>
            <div style={{ ...S.sectionTitle, marginBottom: 0 }}>
              {t.nightBefore}
            </div>
            <span style={{ fontSize: 12, color: nightDone === CHECKLIST_NIGHT_BEFORE.length ? "#22d3a0" : "#64748b" }}>
              {nightDone}/{CHECKLIST_NIGHT_BEFORE.length}
            </span>
          </div>
          <div style={{ background: "rgba(34,211,160,0.04)", border: "1px solid rgba(34,211,160,0.12)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            {CHECKLIST_NIGHT_BEFORE.map((item, i) => {
              const isChecked = !!checked[`${ck}-night-${item.id}`];
              return (
                <div key={item.id}>
                  {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 12px" }} />}
                  <div style={S.checkItem(isChecked)} onClick={() => toggle("night", item.id)}>
                    <div style={S.checkBox(isChecked)}>{isChecked && "✓"}</div>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <span style={{ fontSize: 14, color: isChecked ? "#64748b" : "#e2e8f0", textDecoration: isChecked ? "line-through" : "none" }}>
                      {t.nightItems?.[item.id] ?? item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Match Day checklist */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...S.sectionTitle, marginBottom: 0 }}>
          {daysAway === 0 ? t.matchDay : t.matchDayKit} {isRoad && <span style={{ color: "#ffb347", fontSize: 13 }}>{t.roadBadge}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: dayDone === matchDayItems.length ? "#22d3a0" : "#64748b" }}>
            {dayDone}/{matchDayItems.length}
          </span>
          <button onClick={reset} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>{t.resetAll}</button>
        </div>
      </div>

      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        {matchDayItems.map((item, i) => {
          const isChecked = !!checked[`${ck}-day-${item.id}`];
          const dayLabels = isRoad ? t.roadItems : t.stdItems;
          return (
            <div key={item.id}>
              {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 12px" }} />}
              <div style={S.checkItem(isChecked)} onClick={() => toggle("day", item.id)}>
                <div style={S.checkBox(isChecked)}>{isChecked && "✓"}</div>
                <span style={{ fontSize: 16 }}>{item.emoji}</span>
                <span style={{ fontSize: 14, color: isChecked ? "#64748b" : "#e2e8f0", textDecoration: isChecked ? "line-through" : "none" }}>
                  {dayLabels?.[item.id] ?? item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {dayDone === matchDayItems.length && nightDone === (showNightBefore ? CHECKLIST_NIGHT_BEFORE.length : nightDone) && (
        <div style={{ background: "rgba(34,211,160,0.1)", border: "1px solid rgba(34,211,160,0.25)", borderRadius: 10, padding: 14, marginTop: 12, textAlign: "center" }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ color: "#22d3a0", fontWeight: 600, marginLeft: 8 }}>{t.allSet}</span>
        </div>
      )}

    </div>
  );
}
