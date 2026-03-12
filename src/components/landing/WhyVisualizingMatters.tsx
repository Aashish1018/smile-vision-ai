import { useEffect, useRef, useState } from "react";

const checks = [
  "Analysis completed in under 60 seconds — no waiting rooms",
  "8 dental parameters measured against clinical benchmarks",
  "Your data is encrypted and never shared without consent",
];

const cards = [
  { icon: "verified_user", title: "Clinical-Grade Metrics", body: "Each parameter is benchmarked against orthodontic standards. Alignment, symmetry, and overbite scores are derived from peer-reviewed dental geometry models." },
  { icon: "groups", title: "Dentist-Ready Reports", body: "Share your analysis directly with a verified dental professional. Reports include all 8 metrics, jaw symmetry data, and AI-recommended treatment pathways." },
  { icon: "speed", title: "Informed Decision-Making", body: "78% of patients report feeling more confident in treatment decisions when shown a visual simulation before committing. Remove guesswork from dental care." },
];

const WhyVisualizingMatters = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="py-20 px-4 md:px-12" ref={ref}>
      <div className={`max-w-[1380px] mx-auto rounded-[2rem] p-10 md:p-20 text-white relative overflow-hidden transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary rounded-full blur-[100px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary rounded-full blur-[100px] opacity-10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
          <div>
            <h2 className="text-4xl font-bold mb-6">Why Visualisation Matters</h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              Dental treatment is a significant financial and physical commitment. Research shows that patients who see a simulation of their expected outcome are 3× more likely to follow through with treatment and report higher satisfaction post-procedure.
            </p>
            <div className="space-y-4">
              {checks.map((c) => (
                <div key={c} className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span className="text-slate-200 text-sm">{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end justify-center">
            <p className="text-5xl font-black text-primary mb-1">1,200+</p>
            <p className="text-lg text-slate-400">Scans Completed</p>
            <p className="text-sm text-slate-500 mt-1">and growing every week</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-10 mt-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cards.map((c) => (
              <div key={c.title} className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-primary/50 transition-colors">
                <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined">{c.icon}</span>
                </div>
                <h4 className="text-xl font-bold mb-3 text-white">{c.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyVisualizingMatters;
