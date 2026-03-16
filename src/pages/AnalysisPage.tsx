import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LayoutDashboard, BarChart3, User, LogOut, Settings } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import ScoreGauge from "@/components/ScoreGauge";
import MetricBar from "@/components/MetricBar";
import DoctorModal from "@/components/DoctorModal";
import { useAuth } from "@/contexts/AuthContext";
import { loadScansAsync, deleteScanAsync, type ScanResult } from "@/lib/scanStorage";
import { mockScores, mockJaw, mockRecommendation } from "@/data/mockData";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";

const simulationTabs = ["Braces Overlay", "Whitening", "Jaw Alignment"];

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
  const { user, signOut } = useAuth();
  const [activeSimulation, setActiveSimulation] = useState("Braces Overlay");
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userId = user?.id || "anonymous";

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScan() {
      setLoading(true);
      const fetchedScans = await loadScansAsync(userId);
      const found = fetchedScans.find(s => s.id === id);
      setScan(found || null);
      setLoading(false);
    }
    fetchScan();
  }, [userId, id]);

  const handleDeleteScan = async () => {
    if (!scan) return;
    if (confirm("Are you sure you want to delete this scan?")) {
      await deleteScanAsync(userId, scan.id);
      navigate("/dashboard");
    }
  };

  // Use real scan data if found, fallback to mock
  const scores = scan?.scores || mockScores;
  const jaw = scan?.jaw || mockJaw;
  const recommendation = scan?.recommendation || mockRecommendation;
  const thumbnailUrl = scan?.thumbnailUrl || "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800";

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const metrics = [
    { key: "alignment", label: "Alignment", value: scores.alignment, icon: "straighten", unit: "%", description: "Vertical tooth position regularity" },
    { key: "symmetry", label: "Symmetry", value: scores.symmetry, icon: "compare_arrows", unit: "%", description: "Left-right facial balance" },
    { key: "whiteness", label: "Whiteness", value: scores.whiteness, icon: "brightness_high", unit: "%", description: "LAB colour space L-channel average" },
    { key: "spacing", label: "Spacing", value: scores.spacing, icon: "space_bar", unit: "%", description: "Inter-tooth gap regularity" },
    { key: "gumHealth", label: "Gum Health", value: scores.gumHealth, icon: "healing", unit: "%", description: "Gum line uniformity estimate" },
    { key: "overbite", label: "Overbite", value: scores.overbite, icon: "height", unit: "%", description: "Vertical overlap estimation (Class I)" },
    { key: "toothShape", label: "Tooth Shape", value: scores.toothShape, icon: "crop_square", unit: "%", description: "Regularity of individual tooth geometry" },
    { key: "midlineDeviation", label: "Midline", value: scores.midlineDeviation, icon: "center_focus_strong", unit: "mm", description: "Chin-to-nose centre offset" },
  ];

  const jawMetrics = [
    { label: "MIDLINE", value: jaw.midlineStatus, status: (jaw.deviationMm < 1.5 ? "good" : "mild") as keyof typeof badgeStyles },
    { label: "OCCLUSAL", value: jaw.occlusalStatus, status: "good" as keyof typeof badgeStyles },
    { label: "DEVIATION", value: `${jaw.deviationMm}mm`, status: (jaw.deviationMm < 2 ? "mild" : "concern") as keyof typeof badgeStyles },
    { label: "OVERBITE", value: jaw.overbiteEstimate, status: "mild" as keyof typeof badgeStyles },
  ];

  const gradeInfo = getGrade(scores.overall);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex font-display bg-background-dark relative">
      {/* Floating glass nav — desktop */}
      <div className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-2">
        <button
          onClick={() => navigate("/")}
          className="size-12 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] flex items-center justify-center mb-2 hover:bg-white/[0.08] hover:border-primary/30 transition-all duration-300 group"
        >
          <div className="size-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-sm">flare</span>
          </div>
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="size-12 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] flex items-center justify-center transition-all duration-300 group relative hover:bg-white/[0.08] hover:border-white/15"
        >
          <LayoutDashboard size={18} className="text-slate-400 group-hover:text-ivory" />
          <div className="absolute left-14 px-3 py-1.5 bg-card-dark/95 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold text-ivory opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Dashboard</div>
        </button>
        <button
          className="size-12 rounded-2xl bg-primary/15 backdrop-blur-xl border border-primary/30 flex items-center justify-center transition-all duration-300 shadow-lg shadow-primary/10 group relative"
        >
          <BarChart3 size={18} className="text-primary" />
          <div className="absolute left-14 px-3 py-1.5 bg-card-dark/95 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold text-ivory opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Analytics</div>
        </button>
        <div className="relative mt-auto">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`size-12 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-all duration-300 group ${userMenuOpen ? "bg-primary/15 border-primary/30" : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]"}`}
          >
            <User size={18} className={userMenuOpen ? "text-primary" : "text-slate-400 group-hover:text-ivory"} />
          </button>
          {userMenuOpen && (
            <div className="absolute left-14 bottom-0 w-48 bg-card-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs font-bold text-ivory truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full">
                <Settings size={14} />
                Settings
              </button>
              <div className="border-t border-white/5" />
              <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:pl-20">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="bg-card-dark p-2 rounded-lg border border-white/10">
              <span className="material-symbols-outlined text-ivory">arrow_back</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-ivory">SMILE ANALYSIS</h1>
          </div>
          <div className="flex items-center gap-3">
            {scan && (
              <button
                onClick={handleDeleteScan}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-bold text-sm hover:bg-red-500/20 transition-colors"
                title="Delete Scan"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button className="bg-card-dark p-2 rounded-lg border border-white/10 relative">
              <span className="material-symbols-outlined text-ivory">notifications</span>
              <div className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full" />
            </button>
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
          {/* Column A */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Before/After */}
            <div className="border-2 border-black bg-primary/20 p-1 rounded-lg overflow-hidden">
              <div className="bg-transparent border-b-2 border-black p-4 flex justify-between items-center">
                <span className="text-lg font-black uppercase text-ivory">BEFORE & AFTER TRANSFORMATION</span>
                <div className="flex gap-2">
                  <span className="bg-card-dark text-ivory text-[10px] font-bold uppercase px-2 py-1">FULL HD</span>
                  <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-1">AI ENHANCED</span>
                </div>
              </div>
              <ReactCompareSlider
                itemOne={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage src={thumbnailUrl} alt="Original smile" style={{ objectFit: "cover" }} />
                    <span className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase">ORIGINAL</span>
                  </div>
                }
                itemTwo={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800" alt="Simulated smile" style={{ objectFit: "cover" }} />
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

            {/* Detailed Metrics */}
            <div className="bg-card-dark rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <span className="text-sm font-black uppercase text-ivory">DETAILED METRICS</span>
                <span className="text-xs text-slate-500 ml-auto">8 parameters analysed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
                {metrics.map((m) => (
                  <MetricBar key={m.key} label={m.label} value={m.value} unit={m.unit} icon={m.icon} description={m.description} />
                ))}
              </div>
            </div>
          </div>

          {/* Column B */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Overall Score */}
            <div className="bg-card-dark rounded-2xl p-6 flex flex-col items-center gap-4 border border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">clinical_notes</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-ivory">OVERALL SMILE SCORE</span>
              </div>
              <ScoreGauge score={scores.overall} size={128} />
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${gradeInfo.style}`}>{gradeInfo.grade}</span>
            </div>

            {/* Jaw Analysis */}
            <div className="bg-card-dark rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">face</span>
                <span className="text-sm font-black uppercase text-ivory">JAW SYMMETRY</span>
              </div>
              <div className="p-5 flex flex-col items-center">
                <div className="relative size-48 bg-slate-800 border border-white/10 rounded-full mb-6 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-center bg-contain opacity-40 grayscale" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400')" }} />
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

            {/* Recommended Treatment */}
            <div className="border-2 border-black bg-primary/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-black text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">lightbulb</span>
                </div>
                <span className="text-xl font-black uppercase text-ivory">RECOMMENDED TREATMENT</span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-ivory">
                Based on your results, <span className="underline font-bold">{recommendation.treatments[0]}</span>
                {recommendation.treatments.length > 1 && (
                  <> combined with <span className="underline font-bold">{recommendation.treatments[1]}</span></>
                )} would achieve a {recommendation.matchPct}% match to the simulation within {recommendation.timelineMonths} months.
              </p>
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="text-2xl font-black text-primary">{recommendation.matchPct}%</span>
                  <p className="text-xs text-slate-400">match achievable</p>
                </div>
                <div>
                  <span className="text-2xl font-black text-primary">{recommendation.timelineMonths}</span>
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

            {/* Find a Dentist */}
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

        {/* Footer */}
        <div className="mt-8 border-t-2 border-black pt-6 pb-12">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase">
            Disclaimer: This simulation is for illustrative purposes only and does not constitute medical advice or a guaranteed clinical outcome. Actual results may vary based on individual biological factors and adherence to treatment plans. A physical examination by a licensed dental professional is required to confirm candidacy for the treatments shown. AI-generated metrics are estimates based on provided scan data.
          </p>
          <div className="flex gap-4 mt-3">
            <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>

        {/* Spacer for mobile */}
        <div className="h-20 lg:hidden" />
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card-dark/90 backdrop-blur-xl border-t border-white/[0.08] flex items-center justify-around py-2 px-4">
        <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1 py-1">
          <div className="size-6 bg-primary rounded-md flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xs">flare</span>
          </div>
        </button>
        <button onClick={() => navigate("/dashboard")} className="flex flex-col items-center gap-1 py-1">
          <LayoutDashboard size={20} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500">Home</span>
        </button>
        <button onClick={() => navigate("/scan")} className="size-12 -mt-4 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
          <span className="material-symbols-outlined text-white">add</span>
        </button>
        <button className="flex flex-col items-center gap-1 py-1">
          <BarChart3 size={20} className="text-primary" />
          <span className="text-[10px] font-bold text-primary">Analysis</span>
        </button>
        <button className="flex flex-col items-center gap-1 py-1">
          <User size={20} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500">Profile</span>
        </button>
      </div>

      <DoctorModal open={doctorModalOpen} onClose={() => setDoctorModalOpen(false)} scanId={id || "scan-001"} />
    </div>
  );
};

export default AnalysisPage;
