interface UploadZoneProps {
  onAuthOpen: () => void;
}

const tips = [
  { icon: "wb_sunny", title: "Natural Lighting", body: "Find a spot with soft, even light. Avoid harsh shadows or backlighting." },
  { icon: "center_focus_strong", title: "Straight On View", body: "Keep the camera at eye level and look directly into the lens." },
  { icon: "sentiment_satisfied", title: "Relaxed Smile", body: "Show your teeth naturally, just like you're greeting a friend." },
];

const UploadZone = ({ onAuthOpen }: UploadZoneProps) => {
  return (
    <section id="upload" className="py-20 px-4 md:px-12">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Transform Your Smile Today</h2>
        <p className="text-slate-400 text-center mt-3">Our advanced AI only needs one photo to show you the possibilities.</p>

        <div
          className="mt-12 border-2 border-dashed border-primary/30 rounded-2xl p-16 flex flex-col items-center gap-6 bg-slate-900/30 hover:border-primary/60 transition-colors cursor-pointer"
          onClick={onAuthOpen}
        >
          <span className="material-symbols-outlined text-primary text-6xl">cloud_upload</span>
          <p className="text-xl font-bold text-white">Drag and drop your photo here</p>
          <p className="text-slate-500 text-sm max-w-md text-center">
            Or click to browse your files. Supported formats: JPG, PNG, HEIC (Max 10MB).
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onAuthOpen(); }}
            className="rounded-full h-12 px-8 bg-primary text-white text-base font-bold shadow-md hover:bg-primary/90 transition-colors min-w-[200px]"
          >
            Upload Photo
          </button>
        </div>

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
  );
};

export default UploadZone;
