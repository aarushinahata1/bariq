import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loading } from "@/components/ui/loading";
import { RoleProvider } from "@/hooks/use-role";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import SuperAdmin from "@/pages/SuperAdmin";
import PaymentWall from "@/pages/PaymentWall";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import CRM from "@/pages/CRM";
import Appointments from "@/pages/Appointments";
import Doctors from "@/pages/Doctors";
import Queue from "@/pages/Queue";
import PublicQueue from "@/pages/PublicQueue";
import PatientQueue from "@/pages/PatientQueue";
import PatientHistory from "@/pages/PatientHistory";
import Settings from "@/pages/Settings";

function Router() {
  const { isAuthenticated, isSuperAdmin, isLoading, clinic } = useAuth();
  const [location] = useLocation();

  // Always-public queue routes — no auth needed, show instantly
  const isPublicQueueRoute = location.startsWith("/queue/") || location.startsWith("/patient-queue/");
  if (isPublicQueueRoute) {
    return (
      <Switch>
        <Route path="/queue/:doctorId" component={PublicQueue} />
        <Route path="/patient-queue/:token" component={PatientQueue} />
      </Switch>
    );
  }

  // Public pages (/, /login, /signup) — show immediately while auth loads.
  // Once auth resolves, redirect logged-in users to their dashboard.
  const isPublicPage = location === "/" || location === "/login" || location === "/signup";
  if (isPublicPage) {
    if (!isLoading && isSuperAdmin) return <Redirect to="/super-admin" />;
    if (!isLoading && isAuthenticated) return <Redirect to="/dashboard" />;
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Protected routes — wait for auth check before deciding
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  }

  if (!isAuthenticated && !isSuperAdmin) {
    return <Redirect to="/login" />;
  }

  // Block access when trial/plan has expired — show payment wall
  if (clinic) {
    const now = new Date();
    const trialExpired = clinic.planStatus === "trial" && clinic.trialEndsAt && new Date(clinic.trialEndsAt) < now;
    const planExpired = clinic.planStatus === "expired" || clinic.planStatus === "cancelled";
    const subExpired = clinic.planStatus === "active" && clinic.subscriptionEndsAt && new Date(clinic.subscriptionEndsAt) < now;
    if (trialExpired || planExpired || subExpired) {
      return <PaymentWall />;
    }
  }

  // Super admin
  if (isSuperAdmin) {
    return (
      <Switch>
        <Route path="/super-admin" component={SuperAdmin} />
        <Route><Redirect to="/super-admin" /></Route>
      </Switch>
    );
  }

  // Authenticated clinic user
  return (
    <RoleProvider>
      <Switch>
        <Route path="/queue/:doctorId" component={PublicQueue} />
        <Route path="/patient-queue/:token" component={PatientQueue} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/patients" component={Patients} />
        <Route path="/patients/:id" component={PatientHistory} />
        <Route path="/crm" component={CRM} />
        <Route path="/appointments" component={Appointments} />
        <Route path="/doctors" component={Doctors} />
        <Route path="/queue" component={Queue} />
        <Route path="/settings" component={Settings} />
        <Route><Redirect to="/dashboard" /></Route>
      </Switch>
    </RoleProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
