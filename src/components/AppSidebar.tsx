import { useNavigate } from "react-router-dom";
import { mockUser } from "@/data/mockData";

const navItems = [
  { icon: "dashboard", label: "Dashboard", page: "dashboard" },
  { icon: "analytics", label: "Analysis", page: "analysis" },
  { icon: "auto_fix_high", label: "Simulation", page: "simulation" },
  { icon: "history", label: "History", page: "history" },
];

const bottomItems = [
  { icon: "settings", label: "Preferences" },
];

interface AppSidebarProps {
  activePage: "dashboard" | "analysis" | "simulation" | "history";
  open: boolean;
  onClose: () => void;
}

const AppSidebar = ({ activePage, open, onClose }: AppSidebarProps) => {
  const navigate = useNavigate();

  const handleNav = (page: string) => {
    if (page === "dashboard") navigate("/dashboard");
    else if (page === "analysis") navigate("/analysis/scan-001");
    // TODO: other pages
  };

  const content = (
    <div className="w-64 h-full bg-sidebar-dark border-r-2 border-black flex flex-col p-6 gap-8">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="size-8 bg-black flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-base">flare</span>
        </div>
        <span className="text-ivory text-xl font-black uppercase tracking-tighter">DENTAL VISION</span>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => handleNav(item.page)}
            className={`flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory rounded-lg transition-colors ${
              item.page === activePage ? "bg-black text-white" : "hover:bg-black/10"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {bottomItems.map((item) => (
          <button key={item.label} className="flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory hover:bg-black/10 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory hover:bg-black/10 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Log out
        </button>
      </div>

      {/* TODO: Replace with authenticated user data */}
      <div className="flex items-center gap-3 p-3 bg-white/10 border border-black/10 rounded-xl">
        <img
          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
          alt=""
          className="size-10 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-ivory truncate">{mockUser.name}</p>
          <p className="text-[10px] opacity-60 text-ivory">{mockUser.email}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block h-screen shrink-0">{content}</div>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">{content}</div>
        </>
      )}
    </>
  );
};

export default AppSidebar;
