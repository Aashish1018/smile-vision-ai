import { useNavigate } from "react-router-dom";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

const AuthModal = ({ open, onClose }: AuthModalProps) => {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-dark border border-white/10 rounded-2xl p-8 w-full max-w-sm relative shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="size-12 bg-primary rounded-xl flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-white text-xl">flare</span>
        </div>
        <h2 className="text-xl font-black tracking-tight text-ivory mt-4">Sign in to continue</h2>
        <p className="text-sm text-slate-400 mt-1 mb-6">Create a free account to analyse your smile.</p>

        <button
          onClick={() => { onClose(); navigate("/login"); }}
          className="w-full bg-primary text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition-opacity"
        >
          Sign In / Create Account
        </button>

        <p className="text-[10px] text-slate-600 text-center mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
