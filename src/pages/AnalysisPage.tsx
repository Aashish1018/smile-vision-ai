import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import ScoreGauge from "@/components/ScoreGauge";
import MetricBar from "@/components/MetricBar";
import DoctorModal from "@/components/DoctorModal";
import { mockScores, mockJaw, mockRecommendation } from "@/data/mockData";

const simulationTabs = ["Braces Overlay", "Whitening", "Jaw Alignment"];

const metrics = [
  { key: "alignment", label: "Alignment", value: mockScores.alignment, icon: "straighten", unit: "%", description: "Vertical tooth position regularity" },
  { key: "symmetry", label: "Symmetry", value: mockScores.symmetry, icon: "compare_arrows", unit: "%", description: "Left-right facial balance" },
  { key: "whiteness", label: "Whiteness", value: mockScores.whiteness, icon: "brightness_high", unit: "%", description: "LAB colour space L-channel average" },
  { key: "spacing", label: "Spacing", value: mockScores.spacing, icon: "space_bar", unit: "%", description: "Inter-tooth gap regularity" },
  { key: "gumHealth", label: "Gum Health", value: mockScores.gumHealth, icon: "healing", unit: "%", description: "Gum line uniformity estimate" },
  { key: "overbite", label: "Overbite", value: mockScores.overbite, icon: "height", unit: "%", description: "Vertical overlap estimation (Class I)" },
  { key: "toothShape", label: "Tooth Shape", value: mockScores.toothShape, icon: "crop_square", unit: "%", description: "Regularity of individual tooth geometry" },
  { key: "midlineDeviation", label: "Midline", value: mockScores.midlineDeviation, icon: "center_focus_strong", unit: "mm", description: "Chin-to-nose centre offset" },
];

const jawMetrics = [
  { label: "MIDLINE", value: mockJaw.midlineStatus, status: "good" as const },
  { label: "OCCLUSAL", value: mockJaw.occlusalStatus, status: "good" as const },
  { label: "DEVIATION", value: `${mockJaw.deviationMm}mm`, status: "mild" as const },
  { label: "OVERBITE", value: mockJaw.overbiteEstimate, status: "mild" as const },
];

const badgeStyles = {
  good: "bg-primary/10 text-primary border border-primary/20",
  mild: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
  concern: "bg-red-400/10 text-red-400 border border-red-400/20",
};

const getGrade = (score: number) => {
  if (score >= 90) return { grade: "A", style: "bg-primary/20 text-primary border-primary/30" };
  if (score >= 80) return { grade: "B+", style: "bg-primary/20 text-primary border-primary/30" };
  if (score >= 75) return { grade: "B", style: "bg-primary/20 text-primary border-primary/30" };
  if (score >= 70) return { grade: "C+", style: "bg-amber-400/20 text-amber-400 border-amber-400/30" };
  if (score >= 60) return { grade: "C", style: "bg-amber-400/20 text-amber-400 border-amber-400/30" };
  return { grade: "D", style: "bg-red-400/20 text-red-400 border-red-400/30" };
};

const AnalysisPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState("Braces Overlay");
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);

  const gradeInfo = getGrade(mockScores.overall);

  return (
    <div className="h-screen overflow-hidden flex font-display bg-background-dark">
      <AppSidebar activePage="analysis" open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden bg-card-dark p-2 rounded-lg border border-white/10">
              <span className="material-symbols-outlined text-ivory">menu</span>
            </button>
            <button onClick={() => navigate("/dashboard")} className="bg-card-dark p-2 rounded-lg border border-white/10">
              <span className="material-symbols-outlined text-ivory">arrow_back</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-ivory">SMILE ANALYSIS</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-card-dark p-2 rounded-lg border border-white/10 relative">
              <span className="material-symbols-outlined text-ivory">notifications</span>
              <div className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full" />
            </button>
            {/* TODO: implement save functionality */}
            <button className="hidden sm:flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-sm">save</span>
              Save Plan
            </button>
            <button className="hidden sm:flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 text-ivory rounded-lg font-bold text-sm hover:border-primary transition-colors">
              <span className="material-symbols-outlined text-sm">share</span>
              Share
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Column A — Before/After + Metrics */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* A1 - Before/After */}
            <div className="border-2 border-black bg-primary/20 p-1 rounded-lg overflow-hidden">
              <div className="bg-transparent border-b-2 border-black p-4 flex justify-between items-center">
                <span className="text-lg font-black uppercase text-ivory">BEFORE & AFTER TRANSFORMATION</span>
                <div className="flex gap-2">
                  <span className="bg-card-dark text-ivory text-[10px] font-bold uppercase px-2 py-1">FULL HD</span>
                  <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-1">AI ENHANCED</span>
                </div>
              </div>

              {/* TODO: Replace placeholder images with actual user-uploaded photo and ML-processed result */}
              <ReactCompareSlider
                itemOne={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage
                      src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800"
                      alt="Original smile"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase">ORIGINAL</span>
                  </div>
                }
                itemTwo={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage
                      src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800"
                      alt="Simulated smile"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="absolute bottom-4 right-4 bg-primary text-white px-3 py-1 border border-black text-[10px] font-bold uppercase">SIMULATION</span>
                  </div>
                }
                style={{ width: "100%", aspectRatio: "16/9" }}
                handle={
                  <div className="bg-card-dark border-2 border-black p-1 flex items-center justify-center">
                    <span className="material-symbols-outlined text-ivory text-sm">unfold_more_double</span>
                  </div>
                }
              />

              {/* TODO: Each tab change should re-fetch the corresponding simulation image from API */}
              <div className="flex gap-2 p-4 border-t-2 border-black/20">
                {simulationTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSimulation(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                      activeSimulation === tab
                        ? "bg-primary/20 border border-primary text-primary"
                        : "bg-white/5 border border-white/5 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* A2 - Detailed Metrics */}
            <div className="bg-card-dark rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <span className="text-sm font-black uppercase text-ivory">DETAILED METRICS</span>
                <span className="text-xs text-slate-500 ml-auto">8 parameters analysed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
                {metrics.map((m) => (
                  <MetricBar
                    key={m.key}
                    label={m.label}
                    value={m.value}
                    unit={m.unit}
                    icon={m.icon}
                    description={m.description}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Column B — Score + Jaw + Recommendations + Doctors */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* B1 — Overall Score */}
            {/* TODO: Replace with mockScores.overall from API */}
            <div className="bg-card-dark rounded-2xl p-6 flex flex-col items-center gap-4 border border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">clinical_notes</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-ivory">OVERALL SMILE SCORE</span>
              </div>
              <ScoreGauge score={mockScores.overall} size={128} />
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${gradeInfo.style}`}>
                {gradeInfo.grade}
              </span>
            </div>

            {/* B2 — Jaw Analysis */}
            {/* TODO: Replace with mockJaw data from API */}
            <div className="bg-card-dark rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">face</span>
                <span className="text-sm font-black uppercase text-ivory">JAW SYMMETRY</span>
              </div>
              <div className="p-5 flex flex-col items-center">
                <div className="relative size-48 bg-slate-800 border border-white/10 rounded-full mb-6 flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 bg-center bg-contain opacity-40 grayscale"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400')" }}
                  />
                  <div className="absolute w-full h-px bg-primary/30" />
                  <div className="absolute h-full w-px bg-primary/30" />
                </div>
                <div className="w-full space-y-0">
                  {jawMetrics.map((jm, i) => (
                    <div key={jm.label} className={`flex justify-between items-center py-2 ${i < jawMetrics.length - 1 ? "border-b border-white/5" : ""}`}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{jm.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyles[jm.status]}`}>{jm.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* B3 — Recommended Treatment */}
            {/* TODO: Replace hardcoded recommendation with data.recommendation from API */}
            <div className="border-2 border-black bg-primary/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-black text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">lightbulb</span>
                </div>
                <span className="text-xl font-black uppercase text-ivory">RECOMMENDED TREATMENT</span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-ivory">
                Based on your results, <span className="underline font-bold">{mockRecommendation.treatments[0]}</span> combined with{" "}
                <span className="underline font-bold">{mockRecommendation.treatments[1]}</span> would achieve a{" "}
                {mockRecommendation.matchPct}% match to the simulation within {mockRecommendation.timelineMonths} months.
              </p>
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="text-2xl font-black text-primary">{mockRecommendation.matchPct}%</span>
                  <p className="text-xs text-slate-400">match achievable</p>
                </div>
                <div>
                  <span className="text-2xl font-black text-primary">{mockRecommendation.timelineMonths}</span>
                  <p className="text-xs text-slate-400">months timeline</p>
                </div>
              </div>
              <button
                onClick={() => setDoctorModalOpen(true)}
                className="px-6 py-3 bg-black text-white border-2 border-black font-black uppercase text-sm hover:translate-x-1 hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_0px_rgba(158,193,155,1)] w-full"
              >
                BOOK CONSULTATION
              </button>
            </div>

            {/* B4 — Find a Dentist */}
            <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_hospital</span>
                <span className="text-sm font-black uppercase text-ivory">FIND A DENTIST</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 mb-4">Share your scan with a verified dental professional near you.</p>
              <button
                onClick={() => setDoctorModalOpen(true)}
                className="w-full bg-white/5 border border-white/10 text-ivory text-sm font-bold py-3 rounded-xl hover:border-primary hover:bg-primary/5 transition-colors"
              >
                Browse Doctors →
              </button>
            </div>
          </div>
        </div>

        {/* Footer/Disclaimer */}
        <div className="mt-8 border-t-2 border-black pt-6 pb-12">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase">
            Disclaimer: This simulation is for illustrative purposes only and does not constitute medical advice or a guaranteed clinical outcome. Actual results may vary based on individual biological factors and adherence to treatment plans. A physical examination by a licensed dental professional is required to confirm candidacy for the treatments shown. AI-generated metrics are estimates based on provided scan data.
          </p>
          <div className="flex gap-4 mt-3">
            <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>
      </main>

      <DoctorModal open={doctorModalOpen} onClose={() => setDoctorModalOpen(false)} scanId={id || "scan-001"} />
    </div>
  );
};

export default AnalysisPage;
