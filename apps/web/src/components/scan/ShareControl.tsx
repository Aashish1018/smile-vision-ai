import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ApiError, type Scan } from "@/lib/api";

export function ShareControl({ scan }: { scan: Scan }) {
  const qc = useQueryClient();
  const [consent, setConsent] = useState(false);
  const link = scan.share_token ? `${window.location.origin}/share/${scan.share_token}` : null;

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => api.share(scan.id, enabled, enabled && consent),
    onSuccess: (updated) => {
      qc.setQueryData(["scan", scan.id], updated);
      setConsent(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update sharing."),
  });

  if (!scan.preview_available) return null;

  return (
    <section className="dv-panel rounded-3xl p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={18} className="text-primary" />
        <h2 className="text-lg font-bold">Share your before/after</h2>
      </div>
      {link ? (
        <>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-xl dv-input-surface px-3 py-2 text-xs">{link}</code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy link"
              onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))}
            >
              <Copy size={15} />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
            Stop sharing
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm dv-muted">
            Creates a public link showing only your two photos and scores, with no findings or account details. You
            can revoke it any time.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />I consent to
            these images being viewable by anyone with the link.
          </label>
          <Button onClick={() => mutation.mutate(true)} disabled={!consent || mutation.isPending}>
            Create link
          </Button>
        </>
      )}
    </section>
  );
}
