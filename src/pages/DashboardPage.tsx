import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { mockScores, mockScans, mockProgressData } from "@/data/mockData";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const stats = [
    {
      label: "HEALTH SCORE",
      value: "74",
      sub: (
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-sm">arrow_upward</span>
          <span className="text-xs text-slate-500">+3 since last scan</span>
        </div>
      ),
    },
    {
      label: "TOTAL SCANS",
      value: "2",
      sub: <span className="text-xs text-slate-500">Last: May 12, 2025</span>,
    },
    {
      label: "BEST SCORE",
      value: "74",
      sub: (
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-sm">emoji_events</span>
          <span className="text-xs text-slate-500">Your personal best</span>
        </div>
      ),
    },
    {
      label: "NEXT STEP",
      value: "Whitening",
      isText: true,
      sub: <span className="text-xs text-slate-500">Top recommendation</span>,
    },
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://dentalvision.ai/share/scan-001");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen overflow-hidden flex font-display bg-background-dark">
      <AppSidebar activePage="dashboard" open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden bg-card-dark p-2 rounded-lg border border-white/10"
            >
              <span className="material-symbols-outlined text-ivory">menu</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-ivory">DASHBOARD</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-card-dark p-2 rounded-lg border border-white/10 relative hidden sm:block">
              <span className="material-symbols-outlined text-ivory">notifications</span>
              <div className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full" />
            </button>
            <button
              onClick={() => navigate("/scan")}
              className="hidden sm:flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Scan
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-card-dark rounded-2xl p-5 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={`${s.isText ? "text-xl" : "text-3xl"} font-black text-ivory mt-1`}>{s.value}</p>
              <div className="mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Now vs Ideal */}
            <div className="bg-card-dark rounded-2xl overflow-hidden border border-white/5">
              <div className="flex justify-between items-center p-5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">compare</span>
                  <span className="text-sm font-black uppercase text-ivory">NOW VS IDEAL</span>
                </div>
                <span className="text-xs text-slate-500">Latest Scan — May 12, 2025</span>
              </div>

              <ReactCompareSlider
                itemOne={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800" alt="Original smile" style={{ objectFit: "cover" }} />
                    <span className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase">NOW</span>
                  </div>
                }
                itemTwo={
                  <div className="relative w-full h-full">
                    <ReactCompareSliderImage src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800" alt="Simulated smile" style={{ objectFit: "cover" }} />
                    <span className="absolute bottom-4 right-4 bg-primary text-white px-3 py-1 border border-black text-[10px] font-bold uppercase">IDEAL</span>
                  </div>
                }
                style={{ width: "100%", aspectRatio: "16/9" }}
                handle={
                  <div className="bg-card-dark border-2 border-black p-1 flex items-center justify-center">
                    <span className="material-symbols-outlined text-ivory text-sm">unfold_more_double</span>
                  </div>
                }
              />

              <div className="p-4 flex items-center justify-between border-t border-white/5">
                <span className="text-xs text-slate-400"><span className="text-primary font-bold">96%</span> match achievable</span>
                <button onClick={() => navigate("/analysis/scan-001")} className="text-xs font-bold text-primary cursor-pointer hover:underline">View Full Analysis →</button>
              </div>
            </div>

            {/* Progress Graph */}
            <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">trending_up</span>
                  <span className="text-sm font-black uppercase text-ivory">SMILE PROGRESS</span>
                </div>
                <span className="text-xs text-slate-500">Last 5 months</span>
              </div>
              <ResponsiveContainer width="100%" height={192}>
                <LineChart data={mockProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2030" />
                  <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#4b5563", fontSize: 10 }} />
                  <YAxis domain={[50, 100]} stroke="#4b5563" tick={{ fill: "#4b5563", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#161b22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f8f5e6", fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="#9ec19b" strokeWidth={2} dot={{ fill: "#9ec19b", r: 4 }} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#9ec19b" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#9ec19b", r: 3, strokeDasharray: "0" }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-500 mt-2">Predicted to reach 83 by August 2025 with consistent treatment</p>
            </div>

            {/* Scan History */}
            <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-black uppercase text-ivory">SCAN HISTORY</span>
                <button onClick={() => navigate("/scan")} className="text-xs font-bold text-primary cursor-pointer hover:underline">New Scan +</button>
              </div>
              {mockScans.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <span className="material-symbols-outlined text-slate-600 text-5xl">image_search</span>
                  <p className="text-sm text-slate-400 font-bold">No scans yet.</p>
                  <p className="text-xs text-slate-600">Take your first scan to get started.</p>
                  <button onClick={() => navigate("/scan")} className="px-6 py-2 border border-white/10 text-slate-400 text-xs font-bold rounded-full hover:border-primary hover:text-primary transition-colors">Start First Scan</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {mockScans.map((scan) => (
                    <div key={scan.id} onClick={() => navigate(`/analysis/${scan.id}`)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5">
                      <div className="size-12 rounded-lg bg-cover bg-center border border-white/10 shrink-0" style={{ backgroundImage: `url(${scan.thumbnailUrl})` }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-ivory">{scan.date}</p>
                        <p className="text-xs text-slate-500">{scan.simulationType}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-primary">{scan.overallScore}</span>
                        <span className="text-xs text-slate-500">/100</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">share</span>
                <span className="text-sm font-black uppercase text-ivory">SHARE YOUR SMILE</span>
              </div>
              <div className="bg-background-dark rounded-xl p-5 border border-white/10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">flare</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dental Vision AI</span>
                </div>
                <span className="text-4xl font-black text-ivory">{mockScores.overall}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smile Health Score</span>
                <div className="flex gap-4 text-[10px] text-slate-500">
                  <span>Alignment {mockScores.alignment}%</span>
                  <span>Symmetry {mockScores.symmetry}%</span>
                </div>
                <span className="text-[8px] text-slate-600 mt-1">dentalvision.ai</span>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={handleCopyLink} className="flex items-center gap-2 w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-300 hover:border-primary hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-sm">link</span>
                  {copied ? "Copied!" : "Copy Public Link"}
                </button>
                <button onClick={() => window.open(`https://wa.me/?text=Check out my Dental Vision score: ${mockScores.overall}/100! https://dentalvision.ai/share/scan-001`, "_blank")} className="flex items-center gap-2 w-full px-4 py-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl text-xs font-bold text-[#25D366] hover:bg-[#25D366]/20 transition-colors">
                  <span className="text-sm font-black">W</span>
                  Share on WhatsApp
                </button>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=Just+got+my+Dental+Vision+AI+smile+score:+${mockScores.overall}/100!+✨&url=https://dentalvision.ai/share/scan-001`, "_blank")} className="flex items-center gap-2 w-full px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition-colors">
                  <span className="text-sm font-black">𝕏</span>
                  Share on X
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for mobile FAB */}
        <div className="h-20 lg:hidden" />
      </main>

      {/* Mobile fixed New Scan FAB */}
      <button
        onClick={() => navigate("/scan")}
        className="fixed bottom-6 right-6 z-30 lg:hidden flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        New Scan
      </button>
    </div>
  );
};

export default DashboardPage;
