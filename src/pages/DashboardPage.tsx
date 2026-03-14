import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, BarChart3, User, LogOut, Settings, ChevronDown, Sun, Moon } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getDashboardStats, loadScans } from "@/lib/scanStorage";
import { mockProgressData } from "@/data/mockData";
import ScoreGauge from "@/components/ScoreGauge";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [activeNav, setActiveNav] = useState<"dashboard" | "analysis">("dashboard");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const userId = user?.id || "anonymous";
  const dashData = getDashboardStats(userId);
  const scans = loadScans(userId);

  // Use real data if available, fallback for empty state
  const hasData = !!dashData;
  const latestScore = dashData?.latest.scores.overall ?? 0;
  const totalScans = scans.length;
  const bestScore = dashData?.bestScore ?? 0;
  const scoreDiff = dashData?.scoreDiff ?? 0;
  const topRec = dashData?.topRecommendation ?? "Take a scan";
  const progressData = dashData?.progressData ?? mockProgressData;
  const latestDate = dashData ? new Date(dashData.latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const stats = [
    {
      label: "HEALTH SCORE",
      value: hasData ? String(latestScore) : "—",
      sub: hasData ? (
        <div className="flex items-center gap-1">
          <span className={`material-symbols-outlined text-sm ${scoreDiff >= 0 ? "text-primary" : "text-red-400"}`}>
            {scoreDiff >= 0 ? "arrow_upward" : "arrow_downward"}
          </span>
          <span className="text-xs text-slate-500">{scoreDiff >= 0 ? "+" : ""}{scoreDiff} since last scan</span>
        </div>
      ) : <span className="text-xs text-slate-500">Complete your first scan</span>,
    },
    {
      label: "TOTAL SCANS",
      value: String(totalScans),
      sub: <span className="text-xs text-slate-500">{hasData ? `Last: ${latestDate}` : "No scans yet"}</span>,
    },
    {
      label: "BEST SCORE",
      value: hasData ? String(bestScore) : "—",
      sub: hasData ? (
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-sm">emoji_events</span>
          <span className="text-xs text-slate-500">Your personal best</span>
        </div>
      ) : <span className="text-xs text-slate-500">—</span>,
    },
    {
      label: "NEXT STEP",
      value: topRec,
      isText: true,
      sub: <span className="text-xs text-slate-500">{hasData ? "Top recommendation" : "Get started"}</span>,
    },
  ];

  const handleCopyLink = () => {
    const scanId = dashData?.latest.id || "scan-001";
    navigator.clipboard.writeText(`https://dentalvision.ai/share/${scanId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = (page: "dashboard" | "analysis") => {
    setActiveNav(page);
    if (page === "analysis" && dashData) {
      navigate(`/analysis/${dashData.latest.id}`);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex font-display bg-background-dark relative">
      {/* Floating glass nav — desktop */}
      <div className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-2">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="size-12 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] flex items-center justify-center mb-2 hover:bg-white/[0.08] hover:border-primary/30 transition-all duration-300 group"
        >
          <div className="size-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-sm">flare</span>
          </div>
        </button>

        {/* Dashboard */}
        <button
          onClick={() => handleNavClick("dashboard")}
          className={`size-12 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-all duration-300 group relative ${
            activeNav === "dashboard"
              ? "bg-primary/15 border-primary/30 shadow-lg shadow-primary/10"
              : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15"
          }`}
        >
          <LayoutDashboard size={18} className={activeNav === "dashboard" ? "text-primary" : "text-slate-400 group-hover:text-ivory"} />
          <div className="absolute left-14 px-3 py-1.5 bg-card-dark/95 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold text-ivory opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Dashboard
          </div>
        </button>

        {/* Analytics */}
        <button
          onClick={() => handleNavClick("analysis")}
          className={`size-12 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-all duration-300 group relative ${
            activeNav === "analysis"
              ? "bg-primary/15 border-primary/30 shadow-lg shadow-primary/10"
              : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15"
          }`}
        >
          <BarChart3 size={18} className={activeNav === "analysis" ? "text-primary" : "text-slate-400 group-hover:text-ivory"} />
          <div className="absolute left-14 px-3 py-1.5 bg-card-dark/95 backdrop-blur-md border border-white/10 rounded-lg text-xs font-bold text-ivory opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Analytics
          </div>
        </button>

        {/* User */}
        <div className="relative mt-auto">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`size-12 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-all duration-300 group ${
              userMenuOpen
                ? "bg-primary/15 border-primary/30"
                : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15"
            }`}
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
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <div className="border-t border-white/5" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card-dark/90 backdrop-blur-xl border-t border-white/[0.08] flex items-center justify-around py-2 px-4">
        <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1 py-1">
          <div className="size-6 bg-primary rounded-md flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xs">flare</span>
          </div>
        </button>
        <button onClick={() => handleNavClick("dashboard")} className="flex flex-col items-center gap-1 py-1">
          <LayoutDashboard size={20} className={activeNav === "dashboard" ? "text-primary" : "text-slate-400"} />
          <span className={`text-[10px] font-bold ${activeNav === "dashboard" ? "text-primary" : "text-slate-500"}`}>Home</span>
        </button>
        <button
          onClick={() => navigate("/scan")}
          className="size-12 -mt-4 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30"
        >
          <span className="material-symbols-outlined text-white">add</span>
        </button>
        <button onClick={() => handleNavClick("analysis")} className="flex flex-col items-center gap-1 py-1">
          <BarChart3 size={20} className={activeNav === "analysis" ? "text-primary" : "text-slate-400"} />
          <span className={`text-[10px] font-bold ${activeNav === "analysis" ? "text-primary" : "text-slate-500"}`}>Analysis</span>
        </button>
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="flex flex-col items-center gap-1 py-1 relative">
          <User size={20} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500">Profile</span>
        </button>
      </div>

      {/* Mobile user menu overlay */}
      {mobileNavOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMobileNavOpen(false)} />
          <div className="fixed bottom-16 right-4 z-50 w-56 bg-card-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 lg:hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-xs font-bold text-ivory truncate">{displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full">
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <div className="border-t border-white/5" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:pl-20">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-ivory">DASHBOARD</h1>
          <div className="hidden sm:flex items-center gap-3">
            <button className="bg-card-dark p-2 rounded-lg border border-white/10 relative">
              <span className="material-symbols-outlined text-ivory">notifications</span>
              <div className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full" />
            </button>
            <button
              onClick={() => navigate("/scan")}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Scan
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-card-dark rounded-xl p-5 border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={`${s.isText ? "text-lg" : "text-3xl"} font-black text-ivory mt-1 truncate`}>{s.value}</p>
              <div className="mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Now vs Ideal */}
            {hasData ? (
              <div className="bg-card-dark rounded-xl overflow-hidden border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)]">
                <div className="flex justify-between items-center p-5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">compare</span>
                    <span className="text-sm font-black uppercase text-ivory">NOW VS IDEAL</span>
                  </div>
                  <span className="text-xs text-slate-500">Latest Scan — {latestDate}</span>
                </div>
                <ReactCompareSlider
                  itemOne={
                    <div className="relative w-full h-full">
                      <ReactCompareSliderImage
                        src={dashData!.latest.thumbnailUrl || "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800"}
                        alt="Original smile"
                        style={{ objectFit: "cover" }}
                      />
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
                  <span className="text-xs text-slate-400"><span className="text-primary font-bold">{dashData!.latest.recommendation.matchPct}%</span> match achievable</span>
                  <button onClick={() => navigate(`/analysis/${dashData!.latest.id}`)} className="text-xs font-bold text-primary cursor-pointer hover:underline">View Full Analysis →</button>
                </div>
              </div>
            ) : (
              <div className="bg-card-dark rounded-xl p-12 border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)] flex flex-col items-center gap-4 text-center">
                <span className="material-symbols-outlined text-slate-600 text-6xl">add_a_photo</span>
                <h3 className="text-lg font-black text-ivory">No scans yet</h3>
                <p className="text-sm text-slate-400 max-w-sm">Take your first scan to see a before/after comparison and get your personalized smile health score.</p>
                <button onClick={() => navigate("/scan")} className="mt-2 px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity">
                  Start First Scan
                </button>
              </div>
            )}

            {/* Progress Graph */}
              <div className="bg-card-dark rounded-xl p-5 border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)]">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">trending_up</span>
                    <span className="text-sm font-black uppercase text-ivory">SMILE PROGRESS</span>
                  </div>
                  <span className="text-xs text-slate-500">{hasData ? `${totalScans} scan${totalScans > 1 ? "s" : ""}` : "No data"}</span>
                </div>
                {hasData ? (
                  <>
                    <ResponsiveContainer width="100%" height={192}>
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1c2030" />
                        <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#4b5563", fontSize: 10 }} />
                        <YAxis domain={[50, 100]} stroke="#4b5563" tick={{ fill: "#4b5563", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#161b22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f8f5e6", fontSize: 12 }} />
                        <Line type="monotone" dataKey="score" stroke="#9ec19b" strokeWidth={2} dot={{ fill: "#9ec19b", r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="predicted" stroke="#9ec19b" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#9ec19b", r: 3, strokeDasharray: "0" }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-slate-500 mt-2">
                      Predicted to reach {Math.min(99, latestScore + 9)} with consistent treatment
                    </p>
                  </>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
                    Complete a scan to see progress tracking
                  </div>
                )}
              </div>
          </div>

          {/* Right Column — Scan History (vertical) + Share */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Scan History — vertical cards */}
            <div className="bg-card-dark rounded-xl p-5 border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)] flex flex-col flex-1">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-black uppercase text-ivory">SCAN HISTORY</span>
                <button onClick={() => navigate("/scan")} className="text-xs font-bold text-primary cursor-pointer hover:underline">New Scan +</button>
              </div>
              {scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center flex-1">
                  <span className="material-symbols-outlined text-slate-600 text-4xl">image_search</span>
                  <p className="text-sm text-slate-400 font-bold">No scans yet</p>
                  <p className="text-xs text-slate-600">Take your first scan to get started.</p>
                  <button onClick={() => navigate("/scan")} className="px-5 py-2 border border-white/10 text-slate-400 text-xs font-bold rounded-full hover:border-primary hover:text-primary transition-colors">
                    Start First Scan
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {scans.slice().reverse().map((scan) => (
                    <div
                      key={scan.id}
                      onClick={() => navigate(`/analysis/${scan.id}`)}
                      className="bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:border-primary/20 hover:bg-white/[0.04] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="size-12 rounded-lg bg-cover bg-center border border-white/10 shrink-0"
                          style={{ backgroundImage: scan.thumbnailUrl ? `url(${scan.thumbnailUrl})` : undefined, backgroundColor: scan.thumbnailUrl ? undefined : "#1c2030" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-ivory">
                            {new Date(scan.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{scan.simulationType}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-primary">{scan.scores.overall}</span>
                          <span className="text-xs text-slate-500">/100</span>
                        </div>
                      </div>
                      {/* Mini score bars */}
                      <div className="flex gap-1 mt-2">
                        {[
                          { label: "AL", val: scan.scores.alignment },
                          { label: "SY", val: scan.scores.symmetry },
                          { label: "WH", val: scan.scores.whiteness },
                        ].map((m) => (
                          <div key={m.label} className="flex-1">
                            <div className="flex justify-between">
                              <span className="text-[8px] text-slate-600">{m.label}</span>
                              <span className="text-[8px] text-slate-500">{m.val}</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${m.val}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

              {/* Shareable Badge Card */}
              {hasData && (
                <div className="bg-card-dark rounded-xl border border-black shadow-[2px_2px_0px_0px_rgba(45,60,45,1)] p-5 flex flex-col w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    <span className="text-sm font-black uppercase text-ivory">YOUR BADGE</span>
                  </div>
                  <div className="bg-background-dark rounded-xl p-6 border border-white/10 flex flex-col items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">flare</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dental Vision AI</span>
                    </div>
                    <ScoreGauge score={latestScore} size={100} strokeWidth={8} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smile Health Score</span>
                    <span className="text-xs text-ivory font-bold">{displayName}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => window.open(`https://wa.me/?text=Check out my Dental Vision score: ${latestScore}/100! ${window.location.origin}/share/${dashData!.latest.id}`, "_blank")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl text-xs font-bold text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                    >
                      <span className="text-sm font-black">W</span>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => window.open(`https://twitter.com/intent/tweet?text=Just+got+my+Dental+Vision+AI+smile+score:+${latestScore}/100!+✨&url=${window.location.origin}/share/${dashData!.latest.id}`, "_blank")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition-colors"
                    >
                      <span className="text-sm font-black">𝕏</span>
                      Twitter
                    </button>
                    <button
                      onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/share/${dashData!.latest.id}`)}`, "_blank")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <span className="text-sm font-black">f</span>
                      Facebook
                    </button>
                  </div>
                </div>
              )}

            {/* Copy link button */}
            {hasData && (
              <button onClick={handleCopyLink} className="flex items-center gap-2 w-full px-4 py-2.5 bg-card-dark border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(158,193,155,1)] text-xs font-bold text-slate-300 hover:translate-x-1 hover:-translate-y-1 transition-transform">
                <span className="material-symbols-outlined text-sm">link</span>
                {copied ? "Copied!" : "Copy Public Link"}
              </button>
            )}
          </div>
        </div>

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 lg:hidden" />
      </main>
    </div>
  );
};

export default DashboardPage;
