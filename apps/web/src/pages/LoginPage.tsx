import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, type Me } from "@/lib/api";

function errorMessage(e: unknown) {
  if (e instanceof ApiError || e instanceof Error) return e.message;
  return "Sign-in failed.";
}

function DevLoginForm() {
  const { signInDev } = useAuth();
  const [email, setEmail] = useState("patient@example.com");
  const [role, setRole] = useState<Me["role"]>("patient");
  const [clinic, setClinic] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const clinics = useQuery({ queryKey: ["clinics"], queryFn: api.clinics });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInDev(email, role, role === "dentist" ? clinic || clinics.data?.[0]?.slug || null : null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-primary/10 text-xs px-3 py-2">
        Demo mode: sign in as any email. Pick <b>Dentist</b> to see the clinic review queue.
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-email">Email</Label>
        <Input id="dev-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Me["role"])}>
            <SelectTrigger aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="patient">Patient</SelectItem>
              <SelectItem value="dentist">Dentist</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {role === "dentist" && (
          <div className="space-y-1.5">
            <Label>Clinic</Label>
            <Select value={clinic || clinics.data?.[0]?.slug} onValueChange={setClinic}>
              <SelectTrigger aria-label="Clinic">
                <SelectValue placeholder="Clinic" />
              </SelectTrigger>
              <SelectContent>
                {clinics.data?.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" size={16} />} Continue
      </Button>
    </form>
  );
}

function SupabaseForm() {
  const { signInPassword, signUpPassword, signInGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signInPassword(email, password);
      else {
        await signUpPassword(email, password);
        toast.success("Check your inbox to confirm your email.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" size={16} />} {mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={() => signInGoogle().catch((e) => toast.error(errorMessage(e)))}>
        Continue with Google
      </Button>
      <button
        type="button"
        className="text-xs dv-muted hover:text-primary w-full"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const { status, me, supabaseEnabled, devLoginEnabled } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from;

  if (status === "signedIn" && me) {
    return <Navigate to={from ?? (me.role === "dentist" ? "/clinic" : "/app")} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm dv-panel rounded-3xl p-8 space-y-6">
        <Brand className="justify-center" />
        <h1 className="text-xl font-bold text-center">Sign in to continue</h1>
        {supabaseEnabled && <SupabaseForm />}
        {supabaseEnabled && devLoginEnabled && <div className="text-center text-xs dv-muted">or</div>}
        {devLoginEnabled && <DevLoginForm />}
        {!supabaseEnabled && !devLoginEnabled && (
          <p className="text-sm dv-muted text-center">
            No sign-in method is configured. Set VITE_SUPABASE_URL or VITE_ENABLE_DEV_LOGIN.
          </p>
        )}
        <button onClick={() => navigate("/")} className="text-xs dv-muted hover:text-primary w-full">
          Back to home
        </button>
      </div>
    </div>
  );
}
