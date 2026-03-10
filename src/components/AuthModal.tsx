import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

const AuthModal = ({ open, onClose }: AuthModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (!open) return null;

  const handleGoogleAuth = () => {
    // TODO: Replace with real Supabase Google OAuth
    // await supabase.auth.signInWithOAuth({ provider: 'google' })
    console.log("TODO: Google OAuth");
    navigate("/dashboard");
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with real sign-in
    // const { error } = await supabase.auth.signInWithPassword({ email, password })
    // if (!error) navigate('/dashboard')
    navigate("/dashboard");
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with real sign-up
    // const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    navigate("/dashboard");
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-dark border border-white/10 rounded-2xl p-8 w-full max-w-md relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="size-10 bg-primary rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-white">flare</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-ivory mt-4">Welcome to Dental Vision</h2>
        <p className="text-sm text-slate-400 mt-1">Sign in to analyse your smile and track your progress.</p>

        {/* Tab switcher */}
        <div className="flex rounded-full bg-background-dark p-1 mt-6">
          <button
            onClick={() => setActiveTab("signin")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === "signin" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab("signup")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === "signup" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold text-sm py-3 px-6 rounded-full hover:bg-slate-100 transition-colors mt-4"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Sign In form */}
        {activeTab === "signin" && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition-opacity mt-1"
            >
              Sign In
            </button>
            <button type="button" className="text-xs text-slate-500 hover:text-primary transition-colors text-center mt-1">
              Forgot password?
              {/* TODO: supabase.auth.resetPasswordForEmail(email) */}
            </button>
          </form>
        )}

        {/* Create Account form */}
        {activeTab === "signup" && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition-opacity mt-1"
            >
              Create Account
            </button>
          </form>
        )}

        <p className="text-[10px] text-slate-600 text-center mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
