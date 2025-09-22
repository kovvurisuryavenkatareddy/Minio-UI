import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BucketPage from "./pages/BucketPage";
import Login from "./pages/Login";
import { AuthProvider } from "./contexts/AuthContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Layout from "./components/Layout";
import { ThemeProvider } from "./components/ThemeProvider";
import UpdatePassword from "./pages/UpdatePassword";
import SearchPage from "./pages/SearchPage";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ProfileProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                
                <Route element={<AppLayout />}>
                  <Route path="/bucket/:bucketName/*" element={<BucketPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<AdminRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/admin" element={<AdminDashboard />} />
                    </Route>
                  </Route>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/search" element={<SearchPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProfileProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;