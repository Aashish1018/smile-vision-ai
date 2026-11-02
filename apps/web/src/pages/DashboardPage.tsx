import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ApiImage } from "@/components/ApiImage";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Scan } from "@/lib/api";
import { formatDate, PLAN_STATUS } from "@/lib/labels";

function Trend({ scans }: { scans: Scan[] }) {
  const points = scans
    .filter((s) => s.scores)
    .slice()
    .reverse()
    .map((s) => s.scores!.overall);
  if (points.length < 2) return null;
  const w = 160;
  const h = 40;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${i * step},${h - (p / 100) * h}`).join(" ");
  return (
    <div className="dv-panel rounded-2xl px-4 py-3 flex items-center gap-4">
      <div>
        <p className="text-xs dv-muted">Aesthetics index</p>
        <p className="text-2xl font-black">{points[points.length - 1]}</p>
      </div>
      <svg width={w} height={h} className="overflow-visible" aria-label="Score trend">
        <path d={d} fill="none" className="stroke-primary" strokeWidth={2} />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { data: scans, isLoading } = useQuery({ queryKey: ["scans"], queryFn: api.scans });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My scans</h1>
          <p className="dv-muted mt-1">Each scan is screened, previewed and sent to your clinic for review.</p>
        </div>
        <div className="flex items-center gap-3">
          {scans && <Trend scans={scans} />}
          <Link
            to="/app/scan"
            className="h-11 rounded-full px-5 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold"
          >
            <Plus size={16} /> New scan
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-3xl" />
          ))}
        </div>
      ) : !scans?.length ? (
        <div className="dv-panel rounded-3xl p-12 text-center">
          <p className="font-semibold">No scans yet</p>
          <p className="dv-muted text-sm mt-1">Upload a front-facing smile photo to get started.</p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {scans.map((s) => (
            <li key={s.id}>
              <Link to={`/app/scans/${s.id}`} className="block dv-panel rounded-3xl overflow-hidden dv-hover">
                <ApiImage
                  path={`/api/scans/${s.id}/image/${s.preview_available ? "preview" : "original"}`}
                  alt="Scan photo"
                  className="w-full h-48"
                />
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{formatDate(s.created_at)}</span>
                    {s.scores && <span className="text-sm font-black">{s.scores.overall}</span>}
                  </div>
                  <p className="text-xs dv-muted">
                    {s.triage.level === "see_dentist"
                      ? "Exam recommended"
                      : s.triage.level === "retake"
                        ? "Retake needed"
                        : `${s.findings.observations?.length ?? 0} observation(s)`}
                    {" · "}
                    {s.plan ? PLAN_STATUS[s.plan.status].label : "No plan yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
