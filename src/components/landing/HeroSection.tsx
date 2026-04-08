interface HeroSectionProps {
  onAuthOpen: () => void;
}

const HeroSection = ({ onAuthOpen }: HeroSectionProps) => {
  return (
    <section className="max-w-[1380px] mx-auto px-4 md:px-12 pt-8 pb-16 md:pt-12 md:pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div>
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-4">
            GLOBAL CARE, LOCAL ROOTS
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-ivory mb-6">
            Your Future Smile,
            <br />
            <span className="text-primary">Visualized for You.</span>
          </h1>
          <p className="text-lg md:text-xl dv-muted leading-relaxed mb-8 max-w-xl">
            Built for Indian families and global professionals alike. Preview a realistic smile journey before treatment starts.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={onAuthOpen}
              className="rounded-full h-14 px-8 bg-primary text-white text-base font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform min-w-[180px] inline-flex items-center justify-center"
            >
              Start Visualizing
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/4.25] sm:aspect-[4/4] rounded-[2rem] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black bg-card-dark">
          <img
            src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=2000&auto=format&fit=crop"
            alt="Future Smile Visualization"
            className="w-full h-full object-cover scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#161b22]/80 via-[#161b22]/30 to-[#9ec19b]/20" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#161b22] via-[#161b22]/50 to-transparent" />

          <div className="absolute -top-12 -right-14 size-44 bg-[#9ec19b]/20 blur-3xl" />

          <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl border border-white/15 bg-slate-950/68 backdrop-blur-md shadow-xl flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ring-1 ring-primary/30">
              <span className="material-symbols-outlined">auto_fix_high</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">AI Powered Simulation</p>
              <p className="text-xs text-slate-300">99.2% Visualization Accuracy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
