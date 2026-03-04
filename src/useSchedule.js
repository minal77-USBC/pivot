import { useState, useEffect } from "react";

const CACHE_KEY = "pivot_schedule_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useSchedule() {
  const [k1Matches, setK1] = useState([]);
  const [k2Matches, setK2] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Serve from sessionStorage cache if fresh
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) {
          setK1(data.k1 || []);
          setK2(data.k2 || []);
          setLoading(false);
          return;
        }
      }
    } catch {}

    fetch("/api/schedule")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch {}
        setK1(data.k1 || []);
        setK2(data.k2 || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const refresh = () => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    setLoading(true);
    setError(null);
    fetch("/api/schedule")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch {}
        setK1(data.k1 || []);
        setK2(data.k2 || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  };

  return { k1Matches, k2Matches, loading, error, refresh };
}
