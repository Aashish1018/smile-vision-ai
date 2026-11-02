import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "@/components/scan/ChatPanel";
import { CarePlanCard } from "@/components/scan/CarePlanCard";
import { BeforeAfter, FindingsList, ScoreCard, TriageBanner } from "@/components/scan/ScreeningPanels";
import { ShareControl } from "@/components/scan/ShareControl";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/labels";

export default function ScanDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: scan, isLoading, error } = useQuery({ queryKey: ["scan", id], queryFn: () => api.scan(id) });

  const plan = useMutation({
    mutationFn: () => api.createPlan(id),
    onSuccess: (p) => qc.setQueryData(["scan", id], (s: typeof scan) => (s ? { ...s, plan: p } : s)),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't draft a plan."),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteScan(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan deleted");
      navigate("/app");
    },
  });

  if (isLoading) return <Skeleton className="h-[520px] rounded-3xl" />;
  if (error || !scan) return <p className="dv-muted">This scan doesn't exist or you don't have access to it.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app" className="size-9 rounded-full dv-panel-soft flex items-center justify-center" aria-label="Back">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Scan from {formatDate(scan.created_at)}</h1>
            <p className="text-xs dv-muted">Prompt {String(scan.model_meta.prompt_version ?? "")}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => confirm("Delete this scan and its photos permanently?") && remove.mutate()}
        >
          <Trash2 size={15} /> Delete
        </Button>
      </div>

      <TriageBanner triage={scan.triage} />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <BeforeAfter scan={scan} />
          {scan.scores && <ScoreCard scores={scan.scores} />}
          <ShareControl scan={scan} />
        </div>
        <div className="space-y-6">
          <FindingsList findings={scan.findings} />
          {scan.plan ? (
            <CarePlanCard plan={scan.plan} />
          ) : scan.triage.level !== "retake" ? (
            <section className="dv-panel rounded-3xl p-6 space-y-3">
              <h2 className="text-lg font-bold">Care plan</h2>
              <p className="text-sm dv-muted">
                An AI agent retrieves relevant guidance, drafts a sequenced plan with costs, and sends it to your
                dentist for approval.
              </p>
              <Button onClick={() => plan.mutate()} disabled={plan.isPending}>
                {plan.isPending ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} Draft my plan
              </Button>
            </section>
          ) : null}
          <ChatPanel scanId={scan.id} />
        </div>
      </div>
    </div>
  );
}
