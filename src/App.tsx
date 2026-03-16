import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Analysis from "./pages/Analysis";
import Builder from "./pages/Builder";
import Marketing from "./pages/Marketing";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import ResumeEnhancement from "./pages/ResumeEnhancement";
import InterviewAvatar from "./pages/InterviewAvatar";
import InterviewHistory from "./pages/InterviewHistory";
import JobSearch from "./pages/JobSearch";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const withProtectedLayout = (children: React.ReactNode) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <Toaster />
              <Sonner />

              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pricing" element={<Pricing />} />

                <Route path="/dashboard" element={withProtectedLayout(<Dashboard />)} />
                <Route path="/analysis" element={withProtectedLayout(<Analysis />)} />
                <Route path="/builder" element={withProtectedLayout(<Builder />)} />
                <Route path="/marketing" element={withProtectedLayout(<Marketing />)} />
                <Route path="/profile" element={withProtectedLayout(<Profile />)} />
                <Route path="/settings" element={withProtectedLayout(<Settings />)} />
                <Route path="/enhance" element={withProtectedLayout(<ResumeEnhancement />)} />
                <Route path="/admin" element={withProtectedLayout(<Admin />)} />
                <Route path="/dashboard/interview-avatar" element={withProtectedLayout(<InterviewAvatar />)} />
                <Route path="/dashboard/interview-history" element={withProtectedLayout(<InterviewHistory />)} />
                <Route path="/job-search" element={withProtectedLayout(<JobSearch />)} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
