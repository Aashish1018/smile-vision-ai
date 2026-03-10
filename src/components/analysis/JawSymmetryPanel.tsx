import { mockAnalysisData } from "@/data/mockAnalysis";

const JawSymmetryPanel = () => (
  <div className="col-span-12 lg:col-span-5 bg-card-dark">
    <div className="p-4 flex items-center gap-2 border-b border-black/20">
      <span className="material-symbols-outlined text-primary">face</span>
      <span className="text-sm font-black uppercase text-ivory">JAW SYMMETRY ANALYSIS</span>
    </div>
    <div className="p-4 md:p-6 flex flex-col items-center">
      <div className="relative size-48 bg-slate-800 border border-white/10 rounded-full mb-6 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-contain opacity-40 grayscale"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400')" }}
        />
        <div className="absolute w-full h-px bg-primary/30" />
        <div className="absolute h-full w-px bg-primary/30" />
      </div>

      <div className="w-full space-y-2">
        {/* TODO: Replace with data.jaw.midlineStatus from API */}
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-slate-400 uppercase">MIDLINE</span>
          <span className="text-ivory">{mockAnalysisData.jaw.midlineStatus}</span>
        </div>
        {/* TODO: Replace with data.jaw.occlusalStatus from API */}
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-slate-400 uppercase">OCCLUSAL</span>
          <span className="text-ivory">{mockAnalysisData.jaw.occlusalStatus}</span>
        </div>
      </div>
    </div>
  </div>
);

export default JawSymmetryPanel;
