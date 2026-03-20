import { useEffect, useRef, useState } from "react";

const steps = [
  { num: "01", icon: "add_a_photo", title: "Capture Your Photo", body: "Take a simple front-facing photo with a natural smile. No professional equipment needed." },
  { num: "02", icon: "psychology", title: "AI Analysis", body: "Our AI identifies dental geometry and suggests the most natural improvements for your face shape." },
  { num: "03", icon: "visibility", title: "View Result", body: "Instant access to a high-fidelity visualization of your future smile to share with your dentist." },
];

const HowItWorks = () => {
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
    <section id="how-it-works" className="bg-card-dark py-20 px-4 md:px-12" ref={ref}>
      <div className={`max-w-[1380px] mx-auto transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Precision at every step</h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Our proprietary AI engine analyzes your unique facial structure to generate medical-grade dental simulations in seconds.
            </p>
          </div>
          <div className="hidden md:block h-px flex-1 bg-primary/20 mx-12 mb-4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((s) => (
            <div key={s.num} className="relative">
              <span className="text-primary/20 text-8xl font-black absolute -top-10 -left-4 select-none">{s.num}</span>
              <div className="relative z-10">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined text-2xl">{s.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
