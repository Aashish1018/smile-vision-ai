import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { ApiImage } from "@/components/ApiImage";
import { CarePlanCard } from "@/components/scan/CarePlanCard";
import { FindingsList, TriageBanner } from "@/components/scan/ScreeningPanels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Scan } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

function ReviewActions({ scan, onDone }: { scan: Scan; onDone: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const review = useMutation({
    mutationFn: (action: "approve" | "reject") => api.review(scan.plan!.id, action, notes || null),
    onSuccess: async (p) => {
      toast.success(p.status === "approved" ? "Plan approved and shared with the patient" : "Plan rejected");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["reviews"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Review failed."),
  });

  return (
    <div className="space-y-3 pt-2 border-t border-border/60">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note to the patient (optional)"
        maxLength={2000}
        aria-label="Review notes"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => review.mutate("reject")} disabled={review.isPending}>
          <X size={15} /> Reject
        </Button>
        <Button onClick={() => review.mutate("approve")} disabled={review.isPending}>
          <Check size={15} /> Approve
        </Button>
      </div>
    </div>
  );
}

export default function ClinicPage() {
  const { data: queue, isLoading } = useQuery({ queryKey: ["reviews"], queryFn: api.reviewQueue });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = queue?.find((s) => s.id === selectedId) ?? queue?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review queue</h1>
        <p className="dv-muted mt-1">AI-drafted plans wait here until you approve or reject them, with an optional note to the patient.</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : !queue?.length ? (
        <div className="dv-panel rounded-3xl p-12 text-center">
          <Inbox className="mx-auto text-primary mb-3" />
          <p className="font-semibold">All caught up</p>
          <p className="text-sm dv-muted">New plans appear here when patients request them.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          <ul className="space-y-2">
            {queue.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedId(s.id)}
                  data-testid={`queue-${s.id}`}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl p-2 text-left dv-hover",
                    selected?.id === s.id ? "dv-panel" : "dv-panel-soft",
                  )}
                >
                  <ApiImage path={`/api/scans/${s.id}/image/original`} alt="" className="size-14 rounded-xl" />
                  <div className="text-sm">
                    <p className="font-semibold">{formatDate(s.created_at)}</p>
                    <p className={cn("text-xs", s.plan?.status === "escalated" ? "text-amber-500" : "dv-muted")}>
                      {s.plan?.status === "escalated" ? "Exam recommended" : `${s.plan?.draft?.steps.length ?? 0} steps`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {selected && selected.plan && (
            <div className="space-y-6">
              <TriageBanner triage={selected.triage} />
              <div className="grid xl:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                  <ApiImage path={`/api/scans/${selected.id}/image/original`} alt="Patient photo" className="w-full rounded-3xl" />
                  <FindingsList findings={selected.findings} />
                </div>
                <CarePlanCard
                  plan={selected.plan}
                  actions={<ReviewActions scan={selected} onDone={() => setSelectedId(null)} />}
                />
              </div>
              <p className="text-xs dv-muted">Agent path: {selected.plan.path.join(" → ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
