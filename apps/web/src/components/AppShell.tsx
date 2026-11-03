import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ClipboardCheck, Gauge, LayoutGrid, LogOut, Moon, ScanFace, Sparkles, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 font-bold tracking-tight text-ivory", className)}>
      <span className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
        <Sparkles size={16} />
      </span>
      SmileOS
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="size-9 rounded-full dv-panel-soft flex items-center justify-center dv-hover"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

const patientNav = [
  { to: "/app", label: "My scans", icon: LayoutGrid, end: true },
  { to: "/app/scan", label: "New scan", icon: ScanFace, end: false },
];
const dentistNav = [
  { to: "/clinic", label: "Review queue", icon: ClipboardCheck, end: true },
  { to: "/clinic/metrics", label: "AI metrics", icon: Gauge, end: false },
];

export function AppShell() {
  const { me, email, signOut } = useAuth();
  const navigate = useNavigate();
  const nav = me?.role === "dentist" ? dentistNav : patientNav;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 dv-topbar border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
          <Brand />
          <nav className="flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/15 text-primary" : "dv-muted hover:text-ivory",
                  )
                }
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline text-xs dv-muted">
              {email} · {me?.role === "dentist" ? `Dentist, ${me.clinic}` : "Patient"}
            </span>
            <ThemeToggle />
            <button
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="size-9 rounded-full dv-panel-soft flex items-center justify-center dv-hover"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
