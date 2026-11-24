
import { BrowserRouter, Navigate, Outlet, Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContextCore";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import WhoBenefits from "./components/WhoBenefits";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

import Auth from "./pages/Auth";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import ProjectsPage from "./pages/dashboard/ProjectsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import TemplatesPage from "./pages/dashboard/TemplatesPage";
import ActivityPage from "./pages/dashboard/ActivityPage";
import DiscoveryPage from "./pages/dashboard/DiscoveryPage";
import ProjectWorkspace from "./pages/dashboard/ProjectWorkspace";

import "./App.css";

function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <WhoBenefits />
        <CTA />
        <Footer />
      </main>
    </>
  );
}

function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") return <div className="dashboard-state" role="status">Checking your session...</div>;
  if (status !== "ready") return <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Auth mode="login" />} />

        <Route path="/signup" element={<Auth mode="signup" />} />

        <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="api-explorer" element={<DiscoveryPage />} />
          <Route path="documentation" element={<DiscoveryPage documentation />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="projects/:projectId" element={<Navigate to="design" replace />} />
          <Route path="projects/:projectId/:area" element={<ProjectWorkspace />} />
        </Route>

        <Route path="/projects" element={<DashboardLayout />}>
          <Route index element={<ProjectsPage />} />
          <Route path=":projectId" element={<Navigate to="design" replace />} />
          <Route path=":projectId/:area" element={<ProjectWorkspace />} />
        </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
