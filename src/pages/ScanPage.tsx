import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fileToScanImage,
  loadScans,
  saveScans,
  type AngleModelResult,
  type ScanImage,
  type ScanResult,
} from "@/lib/scanStorage";
import {
  averageScores,
  mergeModelRecommendations,
  parseApiSimulationResult,
  type ApiSimulationResult,
} from "@/lib/modelSchema";
import refFront from "@/assets/guide-front.svg";
import refRight from "@/assets/guide-right.svg";
import refLeft from "@/assets/guide-left.svg";

const steps = [
  {
    step: 1,
    angle: "FRONT" as const,
    icon: "face",
    title: "Center Face Photo",
    instruction: "Look straight ahead in portrait mode. Keep your chin level and both ears visible. This center shot is used in dashboard and ideal scan preview.",
    goodExample: refFront,
  },
  {
    step: 2,
    angle: "RIGHT" as const,
    icon: "face_retouching_natural",
    title: "Right Side Jaw Photo",
    instruction: "Turn your head 90° to the right so only the right profile is visible. Keep your jaw relaxed and stay in the same light.",
    goodExample: refRight,
  },
  {
    step: 3,
    angle: "LEFT" as const,
    icon: "face_retouching_natural",
    title: "Left Side Jaw Photo",
    instruction: "Turn your head 90° to the left so only the left profile is visible. Keep your jaw relaxed and use the same light.",
    goodExample: refLeft,
  },
];

const loadingSteps = [
  "Processing front view…",
  "Processing right profile…",
  "Processing left profile…",
  "Running dental geometry analysis…",
  "Preparing your smile preview…",
];

const API_BASE_URL = "https://ahsheesh-smile-more.hf.space";

async function runModelForFile(file: File): Promise<ApiSimulationResult> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE_URL}/api/teeth/simulate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok || !response.body) {
    throw new Error("ML pipeline did not return a valid response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = "";
  let completePayload: ApiSimulationResult | null = null;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;

    if (!value) continue;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      let eventType = "message";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.substring(7);
        if (line.startsWith("data: ")) data = line.substring(6);
      }

      if (!data) continue;
      const parsed = JSON.parse(data);
      if (eventType === "error") throw new Error(parsed.error || "ML pipeline failed.");
      if (eventType === "complete") completePayload = parseApiSimulationResult(parsed);
    }
  }

  if (!completePayload) throw new Error("ML pipeline completed without payload.");
  return completePayload;
}

const ScanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [photos, setPhotos] = useState<{ [key: number]: File | null }>({ 1: null, 2: null, 3: null });
  const [previews, setPreviews] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [progressFull, setProgressFull] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep - 1];

  const handleFileChange = (step: number, file: File) => {
    setPhotos((prev) => ({ ...prev, [step]: file }));
    const url = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [step]: url }));
    // Scroll to top of content on mobile after selection
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startCamera = async () => {
    // Instead of using a custom UI, trigger the native file input with 'capture' attribute
    const input = document.getElementById(`camera-input-${currentStep}`);
    if (input) {
      input.click();
    }
  };

  const handleAnalyse = useCallback(async () => {
    setLoading(true);
    setLoadingStepIdx(0);
    setProgressFull(false);

    try {
      const angles: ScanImage["angle"][] = ["FRONT", "RIGHT", "LEFT"];
      const scanImages: ScanImage[] = [];

      for (let i = 0; i < 3; i++) {
        const file = photos[i + 1];
        if (!file) continue;
        const scanImage = await fileToScanImage(file, angles[i]);
        scanImages.push(scanImage);
        setLoadingStepIdx(i + 1);
      }

      setLoadingStepIdx(3);

      const angleResults: AngleModelResult[] = [];
      let frontResult: ApiSimulationResult | null = null;
      for (let i = 0; i < 3; i += 1) {
        const file = photos[i + 1];
        if (!file) continue;
        const result = await runModelForFile(file);
        if (i === 0) frontResult = result;
        angleResults.push({
          angle: angles[i],
          issuesList: result.issuesList,
          idealDescription: result.idealDescription,
          scores: result.scores,
          jaw: result.jaw,
          recommendation: result.recommendation,
          modelMeta: result.modelMeta,
        });
        setLoadingStepIdx(Math.min(4, i + 1));
      }

      if (!angleResults.length || !frontResult) {
        throw new Error("AI model chain did not return any structured results.");
      }

      const scores = averageScores(angleResults.map((item) => item.scores));
      const jaw = frontResult.jaw;
      const recommendation = mergeModelRecommendations([frontResult, ...angleResults.slice(1)]);

      setLoadingStepIdx(4);

      const scanId = `scan-${Date.now()}`;
      const mergedIssues = angleResults.flatMap((item) => item.issuesList);
      const uniqueIssues = [...new Set(mergedIssues)].slice(0, 12);
      const scanResult: ScanResult = {
        id: scanId,
        date: new Date().toISOString(),
        images: scanImages,
        scores,
        jaw,
        recommendation,
        thumbnailUrl: previews[1] || "",
        simulationType: recommendation.treatments.slice(0, 2).join(" + ") || "Analysis",
        originalImage: frontResult?.originalImage,
        simulatedImage: frontResult?.simulatedImage,
        idealDescription: frontResult?.idealDescription,
        issuesList: uniqueIssues,
        angleResults,
      };

      if (photos[1]) {
        const thumbImg = await fileToScanImage(photos[1], "FRONT");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = thumbImg.dataUrl;
        await new Promise(r => { img.onload = r; });
        canvas.width = 200;
        canvas.height = 200;
        ctx?.drawImage(img, 0, 0, 200, 200);
        scanResult.thumbnailUrl = canvas.toDataURL("image/jpeg", 0.6);
      }

      const userId = user?.id || "anonymous";
      const existing = await loadScans(userId);
      existing.push(scanResult);
      await saveScans(userId, existing);

      await new Promise(r => setTimeout(r, 800));

      navigate(`/analysis/${scanId}`);
    } catch (err) {
      console.error("Scan processing error:", err);
      setLoading(false);
    }
  }, [photos, previews, user, navigate]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setProgressFull(true), 50);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <div className="min-h-screen bg-background-dark flex flex-col font-display">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-background-dark/95 backdrop-blur-md flex flex-col items-center justify-center gap-6">
          <span className="material-symbols-outlined text-primary text-6xl animate-pulse">auto_fix_high</span>
          <p className="text-lg font-bold text-foreground animate-fade-up">{loadingSteps[loadingStepIdx]}</p>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-[3000ms] ease-linear"
              style={{ width: progressFull ? "100%" : "0%" }}
            />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-card-dark p-2 rounded-lg border border-white/10"
          aria-label="Back to dashboard"
        >
          <span className="material-symbols-outlined text-ivory">arrow_back</span>
        </button>
        <span className="text-sm font-bold text-slate-400">Step {currentStep} of 3</span>
        <span className="font-black text-sm tracking-tight text-ivory">DENTAL VISION</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 w-full shrink-0">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(currentStep / 3) * 100}%` }}
        />
      </div>

      {/* Main content — scrollable on mobile without overflow glitch */}
      <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col items-center px-6 py-8 max-w-xl mx-auto w-full">
          {/* Step badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1 mb-6">
            <span className="material-symbols-outlined text-primary text-sm">{currentStepData.icon}</span>
            <span className="text-primary text-xs font-bold uppercase tracking-widest">
              STEP {currentStepData.step} — {currentStepData.angle}
            </span>
          </div>

          <h2 className="text-3xl font-black tracking-tight text-ivory text-center mb-2">{currentStepData.title}</h2>
          <p className="text-sm text-slate-400 text-center leading-relaxed max-w-sm mb-8">{currentStepData.instruction}</p>

          {/* Guide example */}
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-card-dark/80 p-5 mb-8 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
            <img
              src={currentStepData.goodExample}
              alt={`${currentStepData.angle} guide`}
              className="size-40 rounded-[24px] object-cover mx-auto"
            />
            <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Framing guide</p>
              <p className="mt-1 text-sm text-slate-300">Use this reference for head direction only. Upload from your gallery, or tap <span className="font-semibold text-ivory">Take a Pic</span> to open the camera.</p>
            </div>
          </div>

          {/* Upload zone */}
          <>
            <div
              onClick={() => document.getElementById(`photo-input-${currentStep}`)?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all w-full ${
                photos[currentStep]
                  ? "border-primary bg-primary/5"
                  : "border-white/10 hover:border-primary/50 bg-white/[0.02]"
              }`}
            >
              <input
                id={`photo-input-${currentStep}`}
                type="file"
                accept="image/jpg,image/jpeg,image/png,image/heic"
                capture={undefined}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(currentStep, file);
                  e.target.value = '';
                }}
              />
              {photos[currentStep] ? (
                  <>
                    <img
                      src={previews[currentStep]}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-xl border border-primary/30"
                    />
                    <p className="text-sm font-bold text-ivory truncate max-w-full">{photos[currentStep]!.name}</p>
                    <p className="text-xs text-slate-500">Click to replace</p>
                  </>
                ) : (
                <>
                  <span className="material-symbols-outlined text-slate-400 text-4xl">cloud_upload</span>
                  <p className="text-sm font-bold text-slate-300">Upload {currentStepData.angle} photo from gallery</p>
                  <p className="text-xs text-slate-600">JPG, PNG, HEIC · Max 10MB</p>
                </>
              )}
            </div>

            {/* Native Camera Input (hidden) */}
            <input
              id={`camera-input-${currentStep}`}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(currentStep, file);
                e.target.value = '';
              }}
            />

            {/* Camera button — mobile friendly */}
            <button
              onClick={startCamera}
              className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-slate-300 hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-base">photo_camera</span>
              Take a Pic
            </button>
          </>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 w-full">
            <button
              disabled={currentStep === 1}
              onClick={() => { setCurrentStep((p) => p - 1); }}
              className="px-6 py-2 border border-white/10 text-slate-400 rounded-full text-sm font-bold hover:border-white/20 disabled:opacity-30 transition-colors"
            >
              ← Back
            </button>
            {currentStep < 3 ? (
              <button
                disabled={!photos[currentStep]}
                onClick={() => { setCurrentStep((p) => p + 1); }}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Continue →
              </button>
            ) : (
              <button
                disabled={!photos[1] || !photos[2] || !photos[3]}
                onClick={handleAnalyse}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Analyse My Smile →
              </button>
            )}
          </div>

          {/* Step thumbnails strip */}
          <div className="flex justify-center gap-4 mt-6 pb-8">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => { setCurrentStep(n); }}
                aria-label={`Go to step ${n}`}
                className={`size-14 rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all ${
                  photos[n]
                    ? "border-primary"
                    : n === currentStep
                    ? "border-primary/50 border-dashed"
                    : "border-white/10"
                }`}
              >
                {previews[n] ? (
                  <img src={previews[n]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-600 text-lg">add_photo_alternate</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
