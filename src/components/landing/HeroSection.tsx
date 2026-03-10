interface HeroSectionProps {
  onAuthOpen: () => void;
}

const HeroSection = ({ onAuthOpen }: HeroSectionProps) => {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-12 py-20 md:py-32">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left column */}
        <div>
          <p className="text-primary font-semibold tracking-wider uppercase text-sm mb-4">
            REVOLUTIONIZING SMILES
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-100 mb-6">
            Your Future Smile,
            <br />
            <span className="text-primary">Visualized.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-[540px] mb-8">
            Experience the power of AI-driven dental simulations. See your perfect, confident smile before you even start your journey.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={onAuthOpen}
              className="rounded-full h-14 px-8 bg-primary text-white text-base font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform min-w-[180px] inline-flex items-center justify-center"
            >
              Start Visualizing
            </button>
            <button className="rounded-full h-14 px-8 border-2 border-primary/20 bg-transparent text-slate-200 text-base font-bold hover:bg-primary/5 transition-colors min-w-[180px]">
              View Gallery
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="aspect-square rounded-3xl bg-primary/10 overflow-hidden relative shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800"
            alt="Future Smile Visualization"
            className="w-full h-full object-cover mix-blend-multiply opacity-90"
          />
          <div className="absolute bottom-6 left-6 right-6 p-6 bg-slate-900/90 backdrop-blur rounded-2xl shadow-xl flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">auto_fix_high</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">AI Powered Simulation</p>
              <p className="text-xs text-slate-400">99.2% Visualization Accuracy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
