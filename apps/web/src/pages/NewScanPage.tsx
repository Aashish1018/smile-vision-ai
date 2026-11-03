import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, Sun, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError, streamPost, type Scan } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "normalizing", label: "Preparing photo (metadata stripped)" },
  { key: "screening", label: "Vision model screening" },
  { key: "scoring", label: "Scoring and triage" },
  { key: "preview", label: "Generating whitening preview" },
  { key: "saving", label: "Saving securely" },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;
// Mirrors ALLOWED_FORMATS in services/api imaging/normalize.py; also keeps SVG out of the preview.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function NewScanPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clinics = useQuery({ queryKey: ["clinics"], queryFn: api.clinics });
  const [clinic, setClinic] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) return toast.error("Please choose a JPEG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return toast.error("Photos must be under 10 MB.");
    setFile(f);
  };

  const submit = async () => {
    const clinicSlug = clinic ?? clinics.data?.[0]?.slug;
    if (!file || !clinicSlug) return;
    const form = new FormData();
    form.append("image", file);
    form.append("clinic", clinicSlug);
    setStage("uploading");
    try {
      let created: Scan | null = null;
      await streamPost("/api/scans", form, (event, data) => {
        if (event === "stage") setStage((data as { stage: string }).stage);
        if (event === "scan") created = data as Scan;
      });
      if (!created) throw new Error("No result returned.");
      await qc.invalidateQueries({ queryKey: ["scans"] });
      navigate(`/app/scans/${(created as Scan).id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The screening failed. Please try again.");
      setStage(null);
    }
  };

  const busy = stage !== null;
  const activeIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New scan</h1>
          <p className="dv-muted mt-1">One clear, front-facing smile photo. It's only visible to you and your clinic.</p>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "rounded-3xl border-2 border-dashed border-primary/30 dv-panel-soft overflow-hidden",
            !previewUrl && "p-12 flex flex-col items-center gap-4 text-center",
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Selected photo" className="w-full max-h-[460px] object-contain bg-black/20" />
          ) : (
            <>
              <Upload className="text-primary" size={40} />
              <p className="font-semibold">Drop a photo here, or</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  <Upload size={16} /> Choose file
                </Button>
                <label className="inline-flex">
                  <span className="sr-only">Take a photo</span>
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    capture="user"
                    className="hidden"
                    onChange={(e) => pick(e.target.files?.[0])}
                  />
                  <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input text-sm font-medium cursor-pointer md:hidden">
                    <Camera size={16} /> Camera
                  </span>
                </label>
              </div>
              <p className="text-xs dv-muted">JPEG, PNG or WebP up to 10 MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            data-testid="file-input"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[240px]">
            <Label>Send to clinic</Label>
            <Select value={clinic ?? clinics.data?.[0]?.slug} onValueChange={setClinic} disabled={busy}>
              <SelectTrigger aria-label="Clinic">
                <SelectValue placeholder="Choose a clinic" />
              </SelectTrigger>
              <SelectContent>
                {clinics.data?.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {file && !busy && (
            <Button variant="ghost" onClick={() => setFile(null)}>
              Choose another
            </Button>
          )}
          <Button onClick={submit} disabled={!file || busy} className="ml-auto">
            {busy ? <Loader2 className="animate-spin" size={16} /> : null} Screen photo
          </Button>
        </div>
      </div>

      <aside className="space-y-4">
        {busy ? (
          <div className="dv-panel rounded-3xl p-6" aria-live="polite">
            <h2 className="font-bold mb-4">Working on it…</h2>
            <ol className="space-y-3">
              {STAGES.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "size-6 rounded-full flex items-center justify-center shrink-0",
                      i < activeIndex ? "bg-primary text-primary-foreground" : i === activeIndex ? "bg-primary/20" : "bg-muted",
                    )}
                  >
                    {i < activeIndex ? <Check size={13} /> : i === activeIndex ? <Loader2 size={13} className="animate-spin" /> : null}
                  </span>
                  <span className={i > activeIndex ? "dv-muted" : ""}>{s.label}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs dv-muted mt-4">Local models can take up to a minute.</p>
          </div>
        ) : (
          <div className="dv-panel rounded-3xl p-6 space-y-4 text-sm">
            <h2 className="font-bold">For a useful screening</h2>
            {[
              [Sun, "Soft, even light from the front. No backlight."],
              [Camera, "Camera at mouth height, looking straight on."],
              [Check, "A natural smile with your teeth showing."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Sun;
              return (
                <p key={i} className="flex gap-3 dv-muted">
                  <I size={18} className="text-primary shrink-0" /> {text as string}
                </p>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
