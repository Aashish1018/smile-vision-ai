import { Link } from "react-router-dom";
import { BookOpenCheck, Camera, ClipboardCheck, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Brand, ThemeToggle } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/ref-front.jpg";

const steps = [
  {
    icon: Camera,
    title: "Screen a smile photo",
    body: "A vision model describes what's visible, with a confidence score on every observation, and asks for a retake when the photo isn't good enough.",
  },
  {
    icon: Sparkles,
    title: "Preview and understand",
    body: "See a whitening preview on your detected teeth, and ask questions answered only from cited dental sources.",
  },
  {
    icon: ClipboardCheck,
    title: "Dentist-approved plan",
    body: "An AI agent drafts a costed, sequenced plan. Nothing reaches you as a recommendation until your dentist approves it.",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Screening, not diagnosis",
    body: "Possible lesions or decay are escalated to an in-person exam and never labelled. Cosmetic suggestions pause until a clinician has looked.",
  },
  {
    icon: BookOpenCheck,
    title: "Grounded and cited",
    body: "Answers and plans cite the passages they rely on. Costs come from the clinic's price sheet, not from a model.",
  },
  {
    icon: Stethoscope,
    title: "Built for clinics",
    body: "A review queue, one-click approvals and consented before/after links help dentists explain treatment and earn trust early.",
  },
];

export default function LandingPage() {
  const { status, me } = useAuth();
  const cta = status === "signedIn" ? (me?.role === "dentist" ? "/clinic" : "/app/scan") : "/login";

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to={cta} className="text-sm font-semibold rounded-full px-4 py-2 dv-panel-soft dv-hover">
            {status === "signedIn" ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-10 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-primary font-semibold tracking-wider uppercase text-xs mb-4">AI copilot for dental clinics</p>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
            See your options <span className="text-primary">before the chair.</span>
          </h1>
          <p className="text-lg dv-muted mt-6 max-w-xl">
            SmileOS screens a smile photo, previews whitening, explains treatments with cited sources, and drafts a
            costed care plan that your dentist reviews and approves.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={cta}
              className="rounded-full h-12 px-7 inline-flex items-center bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
            >
              Try a screening
            </Link>
            <a href="#how" className="rounded-full h-12 px-7 inline-flex items-center dv-panel-soft dv-hover font-semibold">
              How it works
            </a>
          </div>
        </div>
        <div className="relative rounded-[2rem] overflow-hidden dv-panel aspect-square">
          <img src={heroImage} alt="Smiling patient" className="w-full h-full object-cover" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-black/60 backdrop-blur p-4 text-white text-sm">
            <p className="font-semibold">Screening, not diagnosis</p>
            <p className="text-white/75 text-xs mt-0.5">
              Every finding shows the model's confidence. Anything concerning goes to a dentist.
            </p>
          </div>
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="dv-panel rounded-3xl p-6">
              <span className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <Icon size={20} />
              </span>
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="dv-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="dv-panel rounded-[2rem] p-8 md:p-12 grid md:grid-cols-3 gap-8">
          {principles.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="text-primary mb-3" size={22} />
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="dv-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 px-4 text-center text-xs dv-muted">
        SmileOS is a portfolio project. It is not a medical device and does not provide medical advice.
      </footer>
    </div>
  );
}
