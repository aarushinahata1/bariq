import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy, Suspense, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loading } from "@/components/ui/loading";
import { RoleProvider, useRole } from "@/hooks/use-role";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const PartnerSignup = lazy(() => import("@/pages/PartnerSignup"));
const PartnerDashboard = lazy(() => import("@/pages/PartnerDashboard"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const PaymentWall = lazy(() => import("@/pages/PaymentWall"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Patients = lazy(() => import("@/pages/Patients"));
const CRM = lazy(() => import("@/pages/CRM"));
const Appointments = lazy(() => import("@/pages/Appointments"));
const Doctors = lazy(() => import("@/pages/Doctors"));
const Queue = lazy(() => import("@/pages/Queue"));
const PublicQueue = lazy(() => import("@/pages/PublicQueue"));
const PatientHistory = lazy(() => import("@/pages/PatientHistory"));
const Settings = lazy(() => import("@/pages/Settings"));
const Register = lazy(() => import("@/pages/Register"));
const Pharmacy = lazy(() => import("@/pages/Pharmacy"));
const DoctorConsole = lazy(() => import("@/pages/DoctorConsole"));

// Blocks navigation to routes the current role isn't allowed into — e.g. a
// receptionist typing /settings or /pharmacy directly into the URL bar. The
// Sidebar already hides these links, but that's cosmetic only; this is the
// actual client-side gate (the server independently enforces the same
// boundary on the API side via requireRole).
function RoleGuard({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { canAccess, config } = useRole();
  if (!canAccess(location)) {
    return <Redirect to={config.defaultRoute} />;
  }
  return <>{children}</>;
}

// Catch-all for unknown paths — sends each role to ITS OWN default route
// (previously hardcoded to /dashboard, which isn't even in doctor's or
// pharmacist's allowedRoutes).
function RoleAwareFallback() {
  const { config } = useRole();
  return <Redirect to={config.defaultRoute} />;
}

function Router() {
  const { isAuthenticated, isSuperAdmin, isPartner, isLoading, clinic } = useAuth();
  const [location] = useLocation();

  // Always-public routes — no auth needed, show instantly
  const isPublicQueueRoute = location.startsWith("/queue/") || location.startsWith("/register/");
  if (isPublicQueueRoute) {
    return (
      <Switch>
        <Route path="/queue/:doctorId" component={PublicQueue} />
        <Route path="/register/:token" component={Register} />
      </Switch>
    );
  }

  // Public pages (/, /login, /signup, /partner-signup) — show immediately while auth loads.
  // Once auth resolves, redirect logged-in users to their dashboard.
  const isPublicPage = location === "/" || location === "/login" || location === "/signup" || location === "/partner-signup";
  if (isPublicPage) {
    if (!isLoading && isSuperAdmin) return <Redirect to="/super-admin" />;
    if (!isLoading && isPartner) return <Redirect to="/partner-dashboard" />;
    if (!isLoading && isAuthenticated) return <Redirect to="/dashboard" />;
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/partner-signup" component={PartnerSignup} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Protected routes — wait for auth check before deciding
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Partner dashboard
  if (isPartner) {
    return (
      <Switch>
        <Route path="/partner-dashboard" component={PartnerDashboard} />
        <Route><Redirect to="/partner-dashboard" /></Route>
      </Switch>
    );
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
        {/* Full-screen pages — no sidebar layout */}
        <Route path="/queue/:doctorId" component={PublicQueue} />
        {/* All app pages share a single persistent Layout */}
        <Route>
          <Layout>
            <RoleGuard>
              <Switch>
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/patients" component={Patients} />
                <Route path="/patients/:id" component={PatientHistory} />
                <Route path="/crm" component={CRM} />
                <Route path="/appointments" component={Appointments} />
                <Route path="/doctors" component={Doctors} />
                <Route path="/queue" component={Queue} />
                <Route path="/settings" component={Settings} />
                <Route path="/pharmacy" component={Pharmacy} />
                <Route path="/doctor-console" component={DoctorConsole} />
                <Route><RoleAwareFallback /></Route>
              </Switch>
            </RoleGuard>
          </Layout>
        </Route>
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
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loading /></div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
