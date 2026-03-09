import { useNavigate } from "react-router-dom";
import { mockAnalysisData } from "@/data/mockAnalysis";

const navItems = [
  { icon: "dashboard", label: "Dashboard", active: true },
  { icon: "analytics", label: "Analysis" },
  { icon: "auto_fix_high", label: "Simulation" },
  { icon: "history", label: "History" },
];

const bottomItems = [
  { icon: "settings", label: "Preferences" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const Sidebar = ({ open, onClose }: SidebarProps) => {
  const navigate = useNavigate();

  const content = (
    <div className="w-64 h-full bg-sidebar-dark border-r-2 border-black flex flex-col p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="size-8 bg-black flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-base">dentistry</span>
        </div>
        <span className="text-ivory text-xl font-black uppercase tracking-tighter">DENTAL VISION</span>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory ${
              item.active ? "bg-black text-white" : "hover:bg-black/10"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-8">
        {bottomItems.map((item) => (
          <button key={item.label} className="flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory hover:bg-black/10">
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 px-3 py-2 font-bold text-sm text-ivory hover:bg-black/10"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Log out
        </button>
      </div>

      {/* TODO: Replace with authenticated user data */}
      <div className="mt-auto flex items-center gap-3 p-3 bg-white/30 border border-black/10">
        <img
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100"
          alt=""
          className="size-10 rounded-full object-cover bg-center"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-ivory truncate">{mockAnalysisData.user.name}</p>
          <p className="text-[10px] opacity-60 text-ivory">{mockAnalysisData.user.role}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block h-screen shrink-0">{content}</div>

      {/* Mobile overlay */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">{content}</div>
        </>
      )}
    </>
  );
};

export default Sidebar;
