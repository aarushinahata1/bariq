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
  const { isAuthenticated, isSuperAdmin, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  }

  // Public routes — always accessible
  const isPublicQueueRoute = location.startsWith("/queue/") || location.startsWith("/patient-queue/");
  if (isPublicQueueRoute) {
    return (
      <Switch>
        <Route path="/queue/:doctorId" component={PublicQueue} />
        <Route path="/patient-queue/:token" component={PatientQueue} />
      </Switch>
    );
  }

  // Not authenticated → show public pages or redirect
  if (!isAuthenticated) {
    const isAuthPage = location === "/" || location === "/login" || location === "/signup";
    if (!isAuthPage) return <Redirect to="/login" />;
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Super admin
  if (isSuperAdmin) {
    if (location === "/" || location === "/login" || location === "/signup") {
      return <Redirect to="/super-admin" />;
    }
    return (
      <Switch>
        <Route path="/super-admin" component={SuperAdmin} />
        <Route><Redirect to="/super-admin" /></Route>
      </Switch>
    );
  }

  // Authenticated clinic user
  if (location === "/" || location === "/login" || location === "/signup") {
    return <Redirect to="/dashboard" />;
  }

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
