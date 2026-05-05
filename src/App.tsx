import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import FunnelSettings from "./pages/FunnelSettings.tsx";
import CustomFields from "./pages/CustomFields.tsx";
import LeadNew from "./pages/LeadNew.tsx";
import LeadDetail from "./pages/LeadDetail.tsx";
import Campaigns from "./pages/Campaigns.tsx";
import CampaignDetail from "./pages/CampaignDetail.tsx";
import Dashboard from "./pages/Dashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell><Index /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/funnel"
              element={
                <ProtectedRoute>
                  <AppShell><FunnelSettings /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/custom-fields"
              element={
                <ProtectedRoute>
                  <AppShell><CustomFields /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads/new"
              element={
                <ProtectedRoute>
                  <AppShell><LeadNew /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads/:leadId"
              element={
                <ProtectedRoute>
                  <AppShell><LeadDetail /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <AppShell><Campaigns /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id"
              element={
                <ProtectedRoute>
                  <AppShell><CampaignDetail /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell><Dashboard /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
