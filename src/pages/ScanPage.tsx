import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fileToScanImage,
  generateHeuristicScores,
  generateJawAnalysis,
  generateRecommendation,
  loadScans,
  saveScans,
  type ScanImage,
  type ScanResult,
} from "@/lib/scanStorage";
import refFront from "@/assets/ref-front.jpg";
import refRight from "@/assets/ref-right.jpg";
import refLeft from "@/assets/ref-left.jpg";

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
    instruction: "Turn your head 90° to the right. Keep your neck straight. Maintain the same natural smile. Stay in the same lighting.",
    goodExample: refRight,
  },
  {
    step: 3,
    angle: "LEFT" as const,
    icon: "face_retouching_natural",
    title: "Left Side Jaw Photo",
    instruction: "Turn your head 90° to the left. Mirror image of the previous step. Same smile, same lighting.",
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

const ScanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [photos, setPhotos] = useState<{ [key: number]: File | null }>({ 1: null, 2: null, 3: null });
  const [previews, setPreviews] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [progressFull, setProgressFull] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not access camera. Please try uploading a photo instead.");
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `${currentStepData.angle.toLowerCase()}-capture.jpg`, { type: "image/jpeg" });
      handleFileChange(currentStep, file);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

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

      const scores = generateHeuristicScores(scanImages);
      const jaw = generateJawAnalysis(scores);
      const recommendation = generateRecommendation(scores);

      setLoadingStepIdx(4);

      const scanId = `scan-${Date.now()}`;
      const scanResult: ScanResult = {
        id: scanId,
        date: new Date().toISOString(),
        images: scanImages,
        scores,
        jaw,
        recommendation,
        thumbnailUrl: previews[1] || "",
        simulationType: recommendation.treatments.slice(0, 2).join(" + ") || "Analysis",
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
          <p className="text-lg font-bold text-white animate-fade-up">{loadingSteps[loadingStepIdx]}</p>
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
          <img
            src={currentStepData.goodExample}
            alt={`${currentStepData.angle} guide`}
            className="size-32 rounded-full border-4 border-primary/30 object-cover mx-auto mb-8 shadow-[0_0_0_4px_rgba(158,193,155,0.15)]"
          />

          {/* Camera view */}
          {cameraActive && (
            <div className="w-full rounded-2xl overflow-hidden border-2 border-primary mb-4 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover bg-black" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="size-16 rounded-full bg-white border-4 border-primary shadow-lg flex items-center justify-center"
                  aria-label="Capture photo"
                >
                  <div className="size-12 rounded-full bg-primary" />
                </button>
                <button
                  onClick={stopCamera}
                  className="size-12 rounded-full bg-card-dark/80 backdrop-blur border border-white/20 flex items-center justify-center"
                  aria-label="Close camera"
                >
                  <span className="material-symbols-outlined text-white">close</span>
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 mb-4">
              <p className="text-xs text-red-400">{cameraError}</p>
            </div>
          )}

          {/* Upload zone */}
          {!cameraActive && (
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

              {/* Camera button — mobile friendly */}
              <button
                onClick={startCamera}
                className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-slate-300 hover:border-primary hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-base">photo_camera</span>
                Take a Pic
              </button>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 w-full">
            <button
              disabled={currentStep === 1}
              onClick={() => { setCurrentStep((p) => p - 1); stopCamera(); }}
              className="px-6 py-2 border border-white/10 text-slate-400 rounded-full text-sm font-bold hover:border-white/20 disabled:opacity-30 transition-colors"
            >
              ← Back
            </button>
            {currentStep < 3 ? (
              <button
                disabled={!photos[currentStep]}
                onClick={() => { setCurrentStep((p) => p + 1); stopCamera(); }}
                className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Continue →
              </button>
            ) : (
              <button
                disabled={!photos[1] || !photos[2] || !photos[3]}
                onClick={handleAnalyse}
                className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
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
                onClick={() => { setCurrentStep(n); stopCamera(); }}
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
