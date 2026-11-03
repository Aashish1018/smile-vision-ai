import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import ClinicPage from "@/pages/ClinicPage";
import DashboardPage from "@/pages/DashboardPage";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import MetricsPage from "@/pages/MetricsPage";
import NewScanPage from "@/pages/NewScanPage";
import NotFound from "@/pages/NotFound";
import ScanDetailPage from "@/pages/ScanDetailPage";
import SharePage from "@/pages/SharePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-center" />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/share/:token" element={<SharePage />} />
                <Route
                  path="/app"
                  element={
                    <RequireAuth role="patient">
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="scan" element={<NewScanPage />} />
                  <Route path="scans/:id" element={<ScanDetailPage />} />
                </Route>
                <Route
                  path="/clinic"
                  element={
                    <RequireAuth role="dentist">
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<ClinicPage />} />
                  <Route path="metrics" element={<MetricsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
