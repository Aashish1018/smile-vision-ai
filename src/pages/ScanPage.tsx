import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    step: 1,
    angle: "FRONT",
    icon: "face",
    title: "Front-Facing Photo",
    instruction: "Look straight at the camera. Keep your chin level. Lips slightly apart, teeth just visible. Natural light preferred.",
    goodExample: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=300",
  },
  {
    step: 2,
    angle: "RIGHT",
    icon: "face_retouching_natural",
    title: "Right Profile Photo",
    instruction: "Turn your head 90° to the right. Keep your neck straight. Maintain the same natural smile. Stay in the same lighting.",
    goodExample: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300",
  },
  {
    step: 3,
    angle: "LEFT",
    icon: "face_retouching_natural",
    title: "Left Profile Photo",
    instruction: "Turn your head 90° to the left. Mirror image of the previous step. Same smile, same lighting.",
    goodExample: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300",
  },
];

const loadingSteps = [
  "Processing front view…",
  "Processing right profile…",
  "Processing left profile…",
  "Running dental geometry analysis…",
  "Generating your simulation…",
];

const ScanPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [photos, setPhotos] = useState<{ [key: number]: File | null }>({ 1: null, 2: null, 3: null });
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [progressFull, setProgressFull] = useState(false);

  const currentStepData = steps[currentStep - 1];

  const handleAnalyse = useCallback(() => {
    setLoading(true);
    setLoadingStepIdx(0);
    setProgressFull(false);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setProgressFull(true), 50);
    const interval = setInterval(() => {
      setLoadingStepIdx((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 600);
    // TODO: Replace with actual FormData upload of all 3 photos to POST /analyze endpoint, then navigate to /analysis/{returned_job_id}
    const nav = setTimeout(() => {
      clearInterval(interval);
      navigate("/analysis/scan-001");
    }, 3000);
    return () => { clearTimeout(t); clearInterval(interval); clearTimeout(nav); };
  }, [loading, navigate]);

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-card-dark p-2 rounded-lg border border-white/10"
        >
          <span className="material-symbols-outlined text-ivory">arrow_back</span>
        </button>
        <span className="text-sm font-bold text-slate-400">Step {currentStep} of 3</span>
        <span className="font-black text-sm tracking-tight text-ivory">DENTAL VISION</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 w-full">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(currentStep / 3) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-xl mx-auto w-full">
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

        {/* Upload zone */}
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
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhotos((prev) => ({ ...prev, [currentStep]: file }));
            }}
          />
          {photos[currentStep] ? (
            <>
              <span className="material-symbols-outlined text-primary text-4xl">check_circle</span>
              <p className="text-sm font-bold text-ivory truncate max-w-full">{photos[currentStep]!.name}</p>
              <p className="text-xs text-slate-500">Click to replace</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-slate-400 text-4xl">cloud_upload</span>
              <p className="text-sm font-bold text-slate-300">Upload {currentStepData.angle} photo</p>
              <p className="text-xs text-slate-600">JPG, PNG, HEIC · Max 10MB</p>
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 w-full">
          <button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((p) => p - 1)}
            className="px-6 py-2 border border-white/10 text-slate-400 rounded-full text-sm font-bold hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>
          {currentStep < 3 ? (
            <button
              disabled={!photos[currentStep]}
              onClick={() => setCurrentStep((p) => p + 1)}
              className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Continue →
            </button>
          ) : (
            <button
              disabled={!photos[3]}
              onClick={handleAnalyse}
              className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Analyse My Smile →
            </button>
          )}
        </div>

        {/* Step thumbnails strip */}
        <div className="flex justify-center gap-4 mt-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`size-14 rounded-xl border-2 overflow-hidden flex items-center justify-center ${
                photos[n]
                  ? "border-primary"
                  : n === currentStep
                  ? "border-primary/50 border-dashed"
                  : "border-white/10"
              }`}
            >
              {photos[n] ? (
                <img src={URL.createObjectURL(photos[n]!)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-slate-600 text-lg">add_photo_alternate</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
