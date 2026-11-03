/**
 * Auth with two interchangeable backends:
 * - Supabase (when VITE_SUPABASE_URL is set): email/password and Google OAuth.
 * - Dev login (when VITE_ENABLE_DEV_LOGIN is "true"): the API issues a signed token, so the full
 *   stack runs locally without an identity provider.
 * Either way the API client gets a bearer token, and the user's role comes from `/api/me`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setTokenProvider, type Me } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const DEV_TOKEN_KEY = "smileos.devToken";
export const DEV_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_DEV_LOGIN === "true";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: Status;
  me: Me | null;
  email: string | null;
  supabaseEnabled: boolean;
  devLoginEnabled: boolean;
  signInDev: (email: string, role: Me["role"], clinic: string | null) => Promise<void>;
  signInPassword: (email: string, password: string) => Promise<void>;
  signUpPassword: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

function readDevToken(): string | null {
  try {
    return sessionStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
      setStatus("signedIn");
    } catch {
      setMe(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    setTokenProvider(async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session.access_token;
      }
      return readDevToken();
    });

    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setEmail(session?.user.email ?? null);
        if (session) void loadMe();
        else if (!readDevToken()) {
          setMe(null);
          setStatus("signedOut");
        }
      });
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session && !readDevToken()) setStatus("signedOut");
      });
      if (readDevToken()) void loadMe();
      return () => sub.subscription.unsubscribe();
    }

    if (readDevToken()) void loadMe();
    else setStatus("signedOut");
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      email,
      supabaseEnabled: Boolean(supabase),
      devLoginEnabled: DEV_LOGIN_ENABLED,
      signInDev: async (devEmail, role, clinic) => {
        const { access_token } = await api.devLogin(devEmail, role, clinic);
        sessionStorage.setItem(DEV_TOKEN_KEY, access_token);
        setEmail(devEmail);
        await loadMe();
      },
      signInPassword: async (e, password) => {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
      },
      signUpPassword: async (e, password) => {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;
      },
      signInGoogle: async () => {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
      },
      signOut: async () => {
        sessionStorage.removeItem(DEV_TOKEN_KEY);
        if (supabase) await supabase.auth.signOut();
        setMe(null);
        setEmail(null);
        setStatus("signedOut");
      },
    }),
    [status, me, email, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
