const Footer = () => (
  <footer className="border-t border-white/5 bg-background-dark py-8 px-4 md:px-12">
    <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="size-6 bg-primary rounded flex items-center justify-center">
          <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>flare</span>
        </div>
        <span className="font-bold text-sm tracking-tight text-slate-100">Dental Vision AI</span>
      </div>

      <div className="flex items-center gap-6">
        {["Privacy", "Terms", "Support", "Contact"].map((l) => (
          <a key={l} href="#" className="text-[13px] font-medium text-slate-500 hover:text-primary transition-colors">{l}</a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[11px] text-slate-600 uppercase tracking-widest">© 2024 All Rights Reserved</span>
        <a href="#" className="text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">public</span>
        </a>
        <a href="#" className="text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">share</span>
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
