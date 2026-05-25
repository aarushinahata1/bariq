import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Calendar,
  Stethoscope,
  Clock,
  Settings,
  Shield,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Role, ROLE_CONFIGS } from "@/lib/roles";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface SidebarProps {
  onNavigate?: () => void;
}

const ROLE_ICONS: Record<Role, string> = {
  admin: "A",
  doctor: "D",
  receptionist: "R",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-teal-500",
  doctor: "bg-emerald-500",
  receptionist: "bg-cyan-500",
};

const ALL_MENU_ITEMS = [
  { label: "Dashboard",       icon: LayoutDashboard, href: "/dashboard" },
  { label: "CRM & Marketing", icon: MessageSquare,   href: "/crm" },
  { label: "Queue Management",icon: Clock,            href: "/queue" },
  { label: "Appointments",    icon: Calendar,         href: "/appointments" },
  { label: "Patients",        icon: Users,            href: "/patients" },
  { label: "Doctors",         icon: Stethoscope,      href: "/doctors" },
  { label: "Settings",        icon: Settings,         href: "/settings" },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { role, setRole, config } = useRole();
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const qc = useQueryClient();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.clear();
    window.location.href = "/login";
  }

  const menuItems = ALL_MENU_ITEMS.filter(item =>
    config.sidebarItems.includes(item.label)
  );

  return (
    <aside className="w-64 bg-teal-800 text-white flex flex-col h-full z-50 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-teal-700/60">
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
          <img src="/bariq_logo.jpg" alt="BariQ" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-none tracking-tight">BariQ</h1>
          <p className="text-[10px] text-teal-200/70 mt-0.5 tracking-widest uppercase">Your Turn, Simplified</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = item.href === "/dashboard"
            ? location === "/dashboard"
            : location.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 group",
                  isActive
                    ? "bg-white text-teal-800 shadow-sm font-semibold"
                    : "text-teal-100/80 hover:bg-teal-700/60 hover:text-white"
                )}
              >
                <Icon className={cn(
                  "w-4.5 h-4.5 flex-shrink-0",
                  isActive ? "text-teal-700" : "text-teal-200/70 group-hover:text-teal-100"
                )} style={{ width: "1.125rem", height: "1.125rem" }} />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-teal-200/70 hover:bg-red-500/20 hover:text-red-300 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
          <span>Logout</span>
        </button>
      </div>

      {/* Role Switcher */}
      <div className="p-3 border-t border-teal-700/60">
        <div className="relative">
          <button
            onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
            className="w-full rounded-xl p-3 flex items-center gap-3 hover:bg-teal-700/50 transition-colors cursor-pointer"
          >
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0", ROLE_COLORS[role])}>
              {ROLE_ICONS[role]}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-white truncate leading-none">{config.label}</p>
              <p className="text-[10px] text-teal-200/60 mt-0.5 truncate uppercase tracking-wider">{config.description}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-teal-300 transition-transform flex-shrink-0", roleSwitcherOpen && "rotate-180")} />
          </button>

          {roleSwitcherOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-teal-900 rounded-xl border border-teal-700 overflow-hidden shadow-2xl">
              <div className="px-3 py-2 border-b border-teal-700/60">
                <div className="flex items-center gap-1.5 text-[10px] text-teal-300 uppercase tracking-widest font-semibold">
                  <Shield className="w-3 h-3" />
                  Switch Role
                </div>
              </div>
              {(Object.keys(ROLE_CONFIGS) as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setRoleSwitcherOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-teal-700/50 transition-colors text-left",
                    r === role && "bg-teal-700/30"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs", ROLE_COLORS[r])}>
                    {ROLE_ICONS[r]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{ROLE_CONFIGS[r].label}</p>
                    <p className="text-[10px] text-teal-300/70 truncate">{ROLE_CONFIGS[r].description}</p>
                  </div>
                  {r === role && <div className="ml-auto w-2 h-2 rounded-full bg-teal-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
