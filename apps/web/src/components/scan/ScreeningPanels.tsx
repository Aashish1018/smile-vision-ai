import { AlertTriangle, Camera, CheckCircle2, Info } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { useApiImage } from "@/hooks/useApiImage";
import type { Scan } from "@/lib/api";
import { CATEGORY_LABEL, SCORE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const DISCLAIMER =
  "AI screening aid, not a diagnosis. Only a licensed dentist can diagnose conditions after an in-person examination.";

export function TriageBanner({ triage }: { triage: Scan["triage"] }) {
  if (triage.level === "routine") {
    return (
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-primary/10 text-sm">
        <CheckCircle2 size={18} className="text-primary shrink-0" />
        No urgent concerns were flagged in this photo. Cosmetic options are shown below.
      </div>
    );
  }
  const retake = triage.level === "retake";
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl px-4 py-3 text-sm flex gap-3",
        retake ? "bg-sky-500/10 text-sky-700 dark:text-sky-200" : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
      )}
    >
      {retake ? <Camera size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
      <div>
        <p className="font-semibold">
          {retake ? "We couldn't screen this photo" : "Please see a dentist before cosmetic treatment"}
        </p>
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
          {triage.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {retake && <p className="mt-1">Try a well-lit, front-facing photo with your teeth visible.</p>}
      </div>
    </div>
  );
}

export function BeforeAfter({ scan }: { scan: Scan }) {
  const original = useApiImage(`/api/scans/${scan.id}/image/original`);
  const preview = useApiImage(scan.preview_available ? `/api/scans/${scan.id}/image/preview` : null);

  if (!original.url) return <div className="aspect-square rounded-3xl animate-pulse bg-muted" />;
  return (
    <figure className="space-y-2">
      <div className="rounded-3xl overflow-hidden dv-panel">
        {preview.url ? (
          <ReactCompareSlider
            itemOne={<ReactCompareSliderImage src={original.url} alt="Your photo" />}
            itemTwo={<ReactCompareSliderImage src={preview.url} alt="Whitening preview" />}
          />
        ) : (
          <img src={original.url} alt="Your photo" className="w-full" />
        )}
      </div>
      <figcaption className="text-xs dv-muted flex gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" />
        {preview.url
          ? "Drag to compare. The preview simulates professional whitening on the detected teeth only; it doesn't predict orthodontic or restorative results."
          : "No preview: the teeth couldn't be isolated reliably in this photo, so we didn't guess."}
      </figcaption>
    </figure>
  );
}

export function FindingsList({ findings }: { findings: Scan["findings"] }) {
  const observations = findings.observations ?? [];
  return (
    <section className="dv-panel rounded-3xl p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold">What the screening noticed</h2>
        <span className="text-xs dv-muted">Photo quality: {findings.image_quality}</span>
      </div>
      <p className="dv-muted text-sm">{findings.summary}</p>
      {observations.length === 0 ? (
        <p className="text-sm">No notable observations.</p>
      ) : (
        <ul className="space-y-3">
          {observations.map((o, i) => (
            <li key={i} className="dv-panel-soft rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{CATEGORY_LABEL[o.category]}</span>
                <span className="text-xs rounded-full px-2 py-0.5 bg-muted capitalize">{o.severity}</span>
                <span className="text-xs dv-muted">{o.location}</span>
              </div>
              <p className="text-sm dv-muted mt-1">{o.evidence}</p>
              <div className="mt-2 flex items-center gap-2 text-xs dv-muted">
                <span className="w-20">Confidence</span>
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.round(o.confidence * 100)}%` }} />
                </div>
                <span className="w-9 text-right tabular-nums">{Math.round(o.confidence * 100)}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs dv-muted">{DISCLAIMER}</p>
    </section>
  );
}

export function ScoreCard({ scores }: { scores: NonNullable<Scan["scores"]> }) {
  const dims = Object.keys(SCORE_LABEL) as (keyof typeof SCORE_LABEL)[];
  return (
    <section className="dv-panel rounded-3xl p-6">
      <div className="flex items-center gap-5">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              className="stroke-primary"
              strokeWidth="3"
              strokeDasharray={`${scores.overall} 100`}
              pathLength={100}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-black">{scores.overall}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold">Smile aesthetics index</h2>
          <p className="text-xs dv-muted mt-1">
            Each area starts at 100 and loses points per observation, weighted by severity and the model's
            confidence. It is a cosmetic summary, not a clinical measurement.
          </p>
        </div>
      </div>
      <dl className="mt-5 space-y-2.5">
        {dims.map((d) => (
          <div key={d} className="flex items-center gap-3 text-sm">
            <dt className="w-32 dv-muted">{SCORE_LABEL[d]}</dt>
            <dd className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full", scores[d] >= 80 ? "bg-primary" : scores[d] >= 60 ? "bg-amber-400" : "bg-red-400")}
                style={{ width: `${scores[d]}%` }}
              />
            </dd>
            <span className="w-8 text-right tabular-nums font-semibold">{scores[d]}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}
