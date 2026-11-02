import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Brand } from "@/components/AppShell";
import { useApiImage } from "@/hooks/useApiImage";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/labels";

export default function SharePage() {
  const { token = "" } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["shared", token], queryFn: () => api.shared(token), retry: false });
  const before = useApiImage(data ? `/api/public/share/${token}/image/original` : null, { auth: false });
  const after = useApiImage(data ? `/api/public/share/${token}/image/preview` : null, { auth: false });

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Brand />
      {isLoading ? (
        <Skeleton className="aspect-square rounded-3xl" />
      ) : error || !data ? (
        <div className="dv-panel rounded-3xl p-10 text-center">
          <p className="font-semibold">This link is no longer available</p>
          <p className="dv-muted text-sm mt-1">The owner may have stopped sharing it.</p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold">Smile preview</h1>
            <p className="dv-muted mt-1">
              {data.clinic_name} · {formatDate(data.created_at)}
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden dv-panel">
            {before.url && after.url ? (
              <ReactCompareSlider
                itemOne={<ReactCompareSliderImage src={before.url} alt="Before" />}
                itemTwo={<ReactCompareSliderImage src={after.url} alt="Whitening preview" />}
              />
            ) : (
              <Skeleton className="aspect-square" />
            )}
          </div>
          <p className="text-xs dv-muted">
            Simulated whitening preview, shared with the patient's consent. Real results vary; ask a dentist.
          </p>
          {data.scores && (
            <p className="text-sm">
              Smile aesthetics index: <b>{data.scores.overall}</b>
            </p>
          )}
          <Link to="/" className="inline-block text-sm text-primary font-semibold">
            Try SmileOS →
          </Link>
        </>
      )}
    </div>
  );
}
