import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api, type Plan, type PlanStep } from "@/lib/api";
import { formatMoney, PLAN_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-muted",
  warn: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  good: "bg-primary/15 text-primary",
  bad: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function Step({ step, index, names }: { step: PlanStep; index?: number; names: Record<string, string> }) {
  return (
    <li className="dv-panel-soft rounded-2xl p-4 flex gap-3">
      {index !== undefined && (
        <span className="size-7 shrink-0 rounded-full bg-primary/15 text-primary text-sm font-bold flex items-center justify-center">
          {index + 1}
        </span>
      )}
      <div className="text-sm">
        <p className="font-semibold">
          {names[step.code] ?? step.code}
          {step.quantity > 1 && <span className="dv-muted font-normal"> × {step.quantity}</span>}
        </p>
        <p className="dv-muted mt-0.5">
          {step.rationale}{" "}
          {step.citations.map((n) => (
            <a key={n} href={`#evidence-${n}`} className="text-primary font-medium hover:underline">
              [{n}]
            </a>
          ))}
        </p>
      </div>
    </li>
  );
}

export function CarePlanCard({ plan, actions }: { plan: Plan; actions?: ReactNode }) {
  const status = PLAN_STATUS[plan.status];
  const alternatives = plan.draft?.alternatives ?? [];
  const { data: treatments } = useQuery({ queryKey: ["treatments"], queryFn: api.treatments, staleTime: Infinity });
  const names = Object.fromEntries((treatments ?? []).map((t) => [t.code, t.name]));

  return (
    <section className="dv-panel rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Care plan</h2>
        <span className={cn("text-xs font-semibold rounded-full px-3 py-1", TONE[status.tone])}>{status.label}</span>
      </div>

      {plan.draft && (
        <>
          <p className="text-sm">{plan.draft.patient_summary}</p>
          <ol className="space-y-2">
            {plan.draft.steps.map((s, i) => (
              <Step key={s.code} step={s} index={i} names={names} />
            ))}
          </ol>
          {alternatives.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Alternatives to discuss</h3>
              <ul className="space-y-2">
                {alternatives.map((s) => (
                  <Step key={s.code} step={s} names={names} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {plan.estimate && plan.estimate.lines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Indicative cost at {plan.estimate.clinic}</h3>
          <table className="w-full text-sm">
            <tbody>
              {plan.estimate.lines.map((l) => (
                <tr key={l.code} className="border-b border-border/60">
                  <td className="py-1.5">
                    {l.name}
                    {l.quantity > 1 && <span className="dv-muted"> × {l.quantity}</span>}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums whitespace-nowrap">
                    {formatMoney(l.low, plan.estimate!.currency)} – {formatMoney(l.high, plan.estimate!.currency)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-2">Total</td>
                <td className="pt-2 pl-3 text-right tabular-nums whitespace-nowrap">
                  {formatMoney(plan.estimate.total_low, plan.estimate.currency)} –{" "}
                  {formatMoney(plan.estimate.total_high, plan.estimate.currency)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs dv-muted mt-2">{plan.estimate.note}</p>
        </div>
      )}

      {plan.review_notes && (
        <blockquote className="border-l-2 border-primary pl-3 text-sm">
          <span className="font-semibold">Dentist's note:</span> {plan.review_notes}
        </blockquote>
      )}

      {plan.evidence.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Sources ({plan.evidence.length})</summary>
          <ol className="mt-2 space-y-2">
            {plan.evidence.map((e) => (
              <li key={e.n} id={`evidence-${e.n}`} className="dv-panel-soft rounded-xl p-3 scroll-mt-24">
                <p className="font-medium">
                  [{e.n}] {e.title} › {e.heading}
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex ml-1.5 text-primary">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </p>
                <p className="dv-muted mt-1 line-clamp-3">{e.text}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      {actions}
    </section>
  );
}
