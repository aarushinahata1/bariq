import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Loader2, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useTour, hasSeenTour } from "@/hooks/use-tour";
import { getTourSteps, getTourId } from "@/lib/tour/steps";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { userId, isLoading: authLoading } = useAuth();
  const { realRole } = useRole();
  const { start } = useTour();

  useEffect(() => {
    if (authLoading || !userId) return;
    const tourId = getTourId(realRole);
    if (hasSeenTour(userId, tourId)) return;

    // Give the page's own data a moment to load so conditionally-rendered
    // targets (e.g. the doctor console's current-patient card) have a chance
    // to exist before we query for them.
    const timer = setTimeout(() => {
      start(userId, tourId, getTourSteps(realRole));
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, realRole]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans overflow-x-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-teal-800 border-b border-teal-700 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/bariq_logo.jpg" alt="BariQ" className="h-9 w-auto object-contain" />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="no-default-hover-elevate no-default-active-elevate"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar - Hidden on mobile unless menu is open. Fixed on desktop. */}
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 fixed inset-y-0 left-0 z-40 w-64`}>
        <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-4 md:p-8 md:ml-64 overflow-y-auto w-full max-w-full">
        <div key={location} className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {children}
        </div>
      </main>
    </div>
  );
}
