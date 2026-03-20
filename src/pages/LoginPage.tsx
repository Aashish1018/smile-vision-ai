import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sanitizeAuthError = (message: string) => {
    if (!message) return "Something went wrong. Please try again.";
    if (/(Database|relation|schema|supabase)/i.test(message)) {
      return "Something went wrong during sign in. Please try again.";
    }
    return message.replace(/https?:\/\/[^\s]+/g, "").trim();
  };

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleGoogleAuth = async () => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) setError(sanitizeAuthError(error.message));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(sanitizeAuthError(error.message));
    else navigate("/dashboard");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setSubmitting(false);
    if (error) setError(sanitizeAuthError(error.message));
    else navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 font-display">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white">flare</span>
          </div>
          <span className="text-2xl font-black tracking-tight text-ivory">Dental Vision</span>
        </div>

        <div className="bg-card-dark border border-white/10 rounded-2xl p-8 shadow-2xl dv-panel">
          <h2 className="text-2xl font-black tracking-tight text-ivory text-center">Welcome back</h2>
          <p className="text-sm dv-muted mt-1 text-center">Sign in to analyse your smile and track your progress.</p>

          {/* Tab switcher */}
          <div className="flex rounded-full dv-input-surface p-1 mt-6">
            <button
              onClick={() => { setActiveTab("signin"); setError(""); }}
              className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${
                activeTab === "signin" ? "bg-primary text-white" : "text-slate-400 hover:text-ivory"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setActiveTab("signup"); setError(""); }}
              className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${
                activeTab === "signup" ? "bg-primary text-white" : "text-slate-400 hover:text-ivory"
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

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 mb-3">
              <p className="text-xs text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Sign In form */}
          {activeTab === "signin" && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full dv-input-surface rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full dv-input-surface rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition-opacity mt-1 disabled:opacity-50"
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError("Enter your email first"); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/reset-password",
                  });
                  if (error) setError(sanitizeAuthError(error.message));
                  else setError("Check your email for a reset link.");
                }}
                className="text-xs text-slate-500 hover:text-primary transition-colors text-center mt-1"
              >
                Forgot password?
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
                required
                className="w-full dv-input-surface rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full dv-input-surface rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full dv-input-surface rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white font-bold text-sm py-3 rounded-full hover:opacity-90 transition-opacity mt-1 disabled:opacity-50"
              >
                {submitting ? "Creating account…" : "Create Account"}
              </button>
            </form>
          )}

          <p className="text-[10px] dv-muted text-center mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          className="text-sm text-slate-500 hover:text-primary transition-colors mt-6 mx-auto block"
        >
          ← Back to home
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
