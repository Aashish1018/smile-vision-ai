import { useEffect, useState } from "react";
import { fetchImage } from "@/lib/api";

/** Loads a private image through the authenticated API and revokes the object URL on unmount. */
export function useApiImage(path: string | null, { auth = true } = {}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    fetchImage(path, { auth })
      .then((u) => {
        objectUrl = u;
        if (!cancelled) setUrl(u);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, auth]);

  return { url, failed };
}
