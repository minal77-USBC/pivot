import { useState, useEffect } from "react";
import { buildKids } from "./familyUtils";

export function useFamily(user, refreshKey = 0, shareToken = null) {
  const [kids, setKids] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (shareToken) {
      setLoading(true);
      setError(null);
      fetch(`/api/family?token=${encodeURIComponent(shareToken)}`)
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
        .then(({ family }) => {
          setKids(family ? buildKids(family.kids || []) : []);
          setLoading(false);
        })
        .catch(e => { setError(e.message); setLoading(false); });
      return;
    }
    if (!user?.email) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const credential = sessionStorage.getItem("pivot_credential");
    fetch(`/api/family?email=${encodeURIComponent(user.email)}`, {
      headers: credential ? { Authorization: `Bearer ${credential}` } : {},
    })
      .then(r => {
        if (r.status === 403) {
          sessionStorage.removeItem("pivot_auth");
          sessionStorage.removeItem("pivot_credential");
          window.location.reload();
          return;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const { family } = data;
        setKids(family ? buildKids(family.kids || []) : []);
        if (family?.share_token) {
          setShareUrl(`${window.location.origin}/s/${family.share_token}`);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [user?.email, refreshKey, shareToken]);

  return { kids, loading, error, shareUrl };
}
