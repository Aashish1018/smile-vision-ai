import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Me } from "@/lib/api";

export function RequireAuth({ role, children }: { role?: Me["role"]; children: ReactNode }) {
  const { status, me } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center dv-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (status === "signedOut" || !me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && me.role !== role) return <Navigate to={me.role === "dentist" ? "/clinic" : "/app"} replace />;
  return <>{children}</>;
}
