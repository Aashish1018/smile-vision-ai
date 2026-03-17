import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ChevronDown, LogOut, User, Moon, Sun } from "lucide-react";

interface NavbarProps {
  onAuthOpen: () => void;
}

const Navbar = ({ onAuthOpen }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-border transition-colors ${
        scrolled ? "backdrop-blur-md bg-background/80" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1380px] mx-auto px-4 md:px-12 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">flare</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Dental Vision</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6">
            {["How it Works"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="size-9 rounded-full bg-muted border border-border flex items-center justify-center hover:border-primary/30 hover:bg-primary/10 transition-all"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Moon size={16} className="text-muted-foreground" />
            ) : (
              <Moon size={16} className="text-indigo-500" />
            )}
          </button>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full h-10 px-4 bg-card-dark border border-border text-sm font-bold text-ivory hover:border-primary/30 transition-colors"
              >
                <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <User size={13} />
                </div>
                <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card-dark border border-border rounded-xl overflow-hidden shadow-xl z-50">
                    <button
                      onClick={() => { navigate("/dashboard"); setDropdownOpen(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-ivory hover:bg-muted transition-colors w-full"
                    >
                      <span className="material-symbols-outlined text-primary text-base">dashboard</span>
                      Dashboard
                    </button>
                    <div className="border-t border-border" />
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onAuthOpen}
              className="rounded-full h-10 px-5 bg-primary text-white text-sm font-bold hover:opacity-90 shadow-sm transition-opacity"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
