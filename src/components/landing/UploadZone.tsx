import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const loadingSteps = [
  "Detecting face landmarks…",
  "Analysing dental geometry…",
  "Calculating jaw symmetry…",
  "Generating your simulation…",
  "Finalising results…",
];

const tips = [
  { icon: "wb_sunny", title: "Natural Lighting", body: "Find a spot with soft, even light. Avoid harsh shadows or backlighting." },
  { icon: "center_focus_strong", title: "Straight On View", body: "Keep the camera at eye level and look directly into the lens." },
  { icon: "sentiment_satisfied", title: "Relaxed Smile", body: "Show your teeth naturally, just like you're greeting a friend." },
];

const UploadZone = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [progressFull, setProgressFull] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleFile = useCallback((file: File) => {
    setError("");
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, or HEIC image file.");
      return;
    }
    setLoading(true);
    setStepIdx(0);
    setProgressFull(false);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setProgressFull(true), 50);
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 500);
    const nav = setTimeout(() => {
      clearInterval(interval);
      navigate("/analysis");
    }, 2500);
    return () => { clearTimeout(t); clearInterval(interval); clearTimeout(nav); };
  }, [loading, navigate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 bg-background-dark/95 backdrop-blur-md flex flex-col items-center justify-center gap-6">
          <span className="material-symbols-outlined text-primary text-6xl animate-pulse">auto_fix_high</span>
          <p className="text-lg font-bold text-white animate-fade-up">{loadingSteps[stepIdx]}</p>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-[2500ms] ease-linear"
              style={{ width: progressFull ? "100%" : "0%" }}
            />
          </div>
        </div>
      )}

      <section id="upload" className="py-20 px-6 md:px-20" ref={sectionRef}>
        <div className={`max-w-7xl mx-auto transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Transform Your Smile Today</h2>
          <p className="text-slate-400 text-center mt-3">Our advanced AI only needs one photo to show you the possibilities.</p>

          <div
            className="mt-12 border-2 border-dashed border-primary/30 rounded-2xl p-16 flex flex-col items-center gap-6 bg-slate-900/30 hover:border-primary/60 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <span className="material-symbols-outlined text-primary text-6xl">cloud_upload</span>
            <p className="text-xl font-bold text-white">Drag and drop your photo here</p>
            <p className="text-slate-500 text-sm max-w-md text-center">
              Or click to browse your files. Supported formats: JPG, PNG, HEIC (Max 10MB).
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="rounded-full h-12 px-8 bg-primary text-white text-base font-bold shadow-md hover:bg-primary/90 transition-colors min-w-[200px]"
            >
              Upload Photo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpg,image/jpeg,image/png,image/heic"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}

          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary">tips_and_updates</span>
              <h3 className="text-xl font-bold text-slate-100">Tips for Best Results</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tips.map((t) => (
                <div key={t.title} className="bg-card-dark p-6 rounded-2xl border border-primary/5">
                  <span className="material-symbols-outlined text-primary text-3xl mb-4 block">{t.icon}</span>
                  <h4 className="font-bold mb-2 text-slate-100">{t.title}</h4>
                  <p className="text-sm text-slate-500">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default UploadZone;
