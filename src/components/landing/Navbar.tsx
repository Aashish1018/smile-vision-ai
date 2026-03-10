import { useEffect, useState } from "react";

interface NavbarProps {
  onAuthOpen: () => void;
}

const Navbar = ({ onAuthOpen }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-white/5 transition-colors ${
        scrolled ? "backdrop-blur-md bg-background-dark/80" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-12 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">flare</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-100">Dental Vision</span>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6">
            {["How it Works", "Pricing", "FAQ"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-medium text-slate-300 hover:text-primary transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
          <button
            onClick={onAuthOpen}
            className="rounded-full h-10 px-5 bg-primary text-white text-sm font-bold hover:opacity-90 shadow-sm transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
