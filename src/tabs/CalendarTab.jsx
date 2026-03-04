import { useState } from "react";
import MatchCard from "../components/MatchCard";
import { S } from "../styles";
import { KIDS } from "../data";
import { upcoming } from "../utils";

export default function CalendarTab({ k1Matches, k2Matches }) {
  const [kidId, setKidId] = useState("k1");
  const kid = KIDS.find(k => k.id === kidId);
  const allMatches = kidId === "k1" ? k1Matches : k2Matches;
  const matches = upcoming(allMatches);

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

      {/* Competition banner */}
      <div style={{ ...S.card({ padding: "10px 14px", marginBottom: 16, background: "rgba(255,255,255,0.03)" }) }}>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
          <span style={{ color: kid.color }}>{kid.competition}</span><br />
          <span>{kid.phase}</span>
        </div>
      </div>

      <div style={S.sectionTitle}>{matches.length} Remaining</div>
      {matches.length === 0 && (
        <div style={{ ...S.card(), color: "#64748b", textAlign: "center", padding: 24 }}>
          Season complete 🏆
        </div>
      )}
      {matches.map((m, i) => (
        <MatchCard key={i} m={m} kidColor={kid.color} compact={false} arrivalBuffer={kid.arrivalBuffer} />
      ))}
    </div>
  );
}
