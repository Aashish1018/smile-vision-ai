import React from "react";
import { User, LogOut, Settings, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface UserMenuProps {
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  showBackdrop?: boolean;
}

const UserMenu: React.FC<UserMenuProps> = ({ userMenuOpen, setUserMenuOpen, showBackdrop = false }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  if (!userMenuOpen) return null;

  return (
    <>
      {showBackdrop && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
      <div
        className={`absolute z-50 w-56 bg-card-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200 ${
          showBackdrop
            ? "bottom-16 right-4 slide-in-from-bottom-2 fixed lg:hidden"
            : "left-14 bottom-0 slide-in-from-left-2"
        }`}
      >
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
  );
};

export default UserMenu;
