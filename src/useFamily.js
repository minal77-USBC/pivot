import { useState, useEffect } from "react";
import { buildKids } from "./familyUtils";

export function useFamily(user, refreshKey = 0) {
  const [kids, setKids] = useState(null);  // null = not yet loaded
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/family?email=${encodeURIComponent(user.email)}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(({ family }) => {
        setKids(family ? buildKids(family.kids || []) : []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [user?.email, refreshKey]);

  return { kids, loading, error };
}
