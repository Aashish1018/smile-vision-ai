import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="dv-panel rounded-2xl p-5">
      <p className="text-xs dv-muted">{label}</p>
      <p className="text-3xl font-black mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs dv-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function MetricsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["metrics"], queryFn: api.metrics, refetchInterval: 30_000 });
  if (isLoading || !data) return <Skeleton className="h-96 rounded-3xl" />;

  const totalCalls = data.llm.reduce((n, r) => n + r.calls, 0);
  const tokens = data.llm.reduce((n, r) => n + r.prompt_tokens + r.completion_tokens, 0);
  const scans = Object.values(data.triage).reduce((a, b) => a + b, 0);
  const decided = (data.plans.approved ?? 0) + (data.plans.rejected ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">AI metrics</h1>
        <p className="dv-muted mt-1">Model reliability, latency and clinical funnel for the last {data.window_days} days.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Scans screened" value={scans} hint={`${data.triage.see_dentist ?? 0} escalated to an exam`} />
        <Stat label="Preview success" value={`${Math.round(data.preview_rate * 100)}%`} hint="Teeth isolated reliably" />
        <Stat
          label="Plan approval rate"
          value={decided ? `${Math.round(((data.plans.approved ?? 0) / decided) * 100)}%` : "—"}
          hint={`${data.plans.pending_review ?? 0} waiting for review`}
        />
        <Stat label="Model calls" value={totalCalls} hint={`${tokens.toLocaleString()} tokens`} />
      </div>
      <div className="dv-panel rounded-3xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left dv-muted text-xs">
            <tr>
              {["Operation", "Model", "Calls", "Success", "p50", "p95", "Avg repairs", "Tokens in/out"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.llm.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center dv-muted">
                  No model calls yet.
                </td>
              </tr>
            )}
            {data.llm.map((r) => (
              <tr key={`${r.operation}-${r.model}`} className="border-t border-border/60 tabular-nums">
                <td className="px-4 py-3 font-medium">{r.operation}</td>
                <td className="px-4 py-3 dv-muted">{r.model}</td>
                <td className="px-4 py-3">{r.calls}</td>
                <td className="px-4 py-3">{Math.round(r.success_rate * 100)}%</td>
                <td className="px-4 py-3">{(r.p50_ms / 1000).toFixed(1)}s</td>
                <td className="px-4 py-3">{(r.p95_ms / 1000).toFixed(1)}s</td>
                <td className="px-4 py-3">{r.avg_repairs.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {r.prompt_tokens.toLocaleString()} / {r.completion_tokens.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs dv-muted">
        "Repairs" counts structured-output retries after a schema validation failure. Traces are also exported over
        OpenTelemetry when an OTLP endpoint is configured.
      </p>
    </div>
  );
}
