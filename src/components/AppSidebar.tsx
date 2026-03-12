import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, BarChart3, User, LogOut, ChevronDown, Settings, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
  { icon: BarChart3, label: "Analytics", page: "analysis" },
];

interface AppSidebarProps {
  activePage: "dashboard" | "analysis" | "simulation" | "history";
  open: boolean;
  onClose: () => void;
}

const AppSidebar = ({ activePage, open, onClose }: AppSidebarProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleNav = (page: string) => {
    if (page === "dashboard") navigate("/dashboard");
    else if (page === "analysis") navigate("/analysis/scan-001");
    onClose();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";

  const content = (
    <div className="w-[220px] h-full bg-sidebar-dark flex flex-col py-5 px-3">
      {/* Logo — clickable to landing */}
      <button
        onClick={() => { navigate("/"); onClose(); }}
        className="flex items-center gap-2.5 px-3 mb-10 hover:opacity-80 transition-opacity"
      >
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-base">flare</span>
        </div>
        <span className="text-ivory text-base font-black tracking-tight">Dental Vision</span>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = item.page === activePage;
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item.page)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-primary/15 text-primary border-l-[3px] border-primary pl-[9px]"
                  : "text-slate-400 hover:text-ivory hover:bg-white/5"
              }`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="mt-auto pt-4 border-t border-white/5">
        {/* User dropdown trigger */}
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl hover:bg-white/5 transition-all duration-200"
        >
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <User size={15} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-ivory truncate">{displayName}</p>
            <p className="text-[10px] text-slate-500 truncate">{displayEmail}</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown menu */}
        {userMenuOpen && (
          <div className="mt-1 mx-1 bg-card-dark border border-white/10 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => { /* TODO: navigate to profile page */ onClose(); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full"
            >
              <UserCircle size={16} />
              Profile
            </button>
            <button
              onClick={() => { /* TODO: navigate to settings page */ onClose(); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-ivory hover:bg-white/5 transition-colors w-full"
            >
              <Settings size={16} />
              Settings
            </button>
            <div className="border-t border-white/5" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
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
