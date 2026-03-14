import { useNavigate } from "react-router-dom";

const Footer = () => {
  const navigate = useNavigate();

  const shareUrl = encodeURIComponent("https://dentalvision.ai");
  const shareText = encodeURIComponent("Check out Dental Vision AI — AI-powered dental analysis!");

  return (
    <footer className="border-t border-white/5 bg-[#0a0e14] py-8 px-4 md:px-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-[1380px] mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="size-6 bg-primary rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>flare</span>
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-100">Dental Vision AI</span>
        </button>

        <div className="flex items-center gap-6">
          {["Support", "Contact"].map((l) => (
            <a key={l} href="#" className="text-[13px] font-medium text-slate-500 hover:text-primary transition-colors">{l}</a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-600 uppercase tracking-widest">© 2026 All Rights Reserved</span>
          <a
            href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-[#25D366] transition-colors"
            aria-label="Share on WhatsApp"
          >
            <span className="material-symbols-outlined text-lg">chat</span>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-sky-400 transition-colors"
            aria-label="Share on X"
          >
            <span className="material-symbols-outlined text-lg">share</span>
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-500 transition-colors"
            aria-label="Share on Facebook"
          >
            <span className="material-symbols-outlined text-lg">public</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
