import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CookieBanner } from "./components/CookieBanner";
import Landing from "./pages/Landing";
import Preferences from "./pages/Preferences";
import RoutePage from "./pages/Route";
import ChooseLocation from "./pages/ChooseLocation";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import SavedRoutes from "./pages/SavedRoutes";
import SharedRoute from "./pages/SharedRoute";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Pre-launch landing page */}
            <Route path="/" element={<Landing />} />
            {/* Hidden app routes for testing */}
            <Route path="/app" element={<Preferences />} />
            <Route path="/early-access" element={<Auth />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/shared/:shareCode" element={<SharedRoute />} />
            <Route path="/route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
            <Route path="/choose-location" element={<ProtectedRoute><ChooseLocation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/saved-routes" element={<ProtectedRoute><SavedRoutes /></ProtectedRoute>} />
            <Route path="/subscription-success" element={<SubscriptionSuccess />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
