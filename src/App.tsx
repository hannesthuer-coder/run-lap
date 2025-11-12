import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Preferences from "./pages/Preferences";
import RoutePage from "./pages/Route";
import ChooseLocation from "./pages/ChooseLocation";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import SavedRoutes from "./pages/SavedRoutes";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
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
            <Route path="/" element={<Preferences />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
            <Route path="/choose-location" element={<ProtectedRoute><ChooseLocation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/saved-routes" element={<ProtectedRoute><SavedRoutes /></ProtectedRoute>} />
            <Route path="/subscription-success" element={<SubscriptionSuccess />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
