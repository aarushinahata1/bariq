export type Role = "admin" | "doctor" | "receptionist";

/** Granular actions that can be permission-gated */
export type Action =
  | "patients:create"
  | "patients:edit"
  | "appointments:create"
  | "appointments:reschedule"
  | "appointments:generate-bill"
  | "queue:notes"
  | "queue:prescription"
  | "queue:check-in"
  | "queue:status-change"
  | "doctors:manage"
  | "billing:view"
  | "crm:access";

export interface RoleConfig {
  label: string;
  description: string;
  allowedRoutes: string[];
  defaultRoute: string;
  sidebarItems: string[];
  actions: Action[];
}

export const ROLE_CONFIGS: Record<Role, RoleConfig> = {
  admin: {
    label: "Admin",
    description: "Full access to all modules",
    allowedRoutes: [
      "/dashboard",
      "/crm",
      "/queue",
      "/appointments",
      "/patients",
      "/patients/:id",
      "/doctors",
      "/settings",
    ],
    defaultRoute: "/dashboard",
    sidebarItems: [
      "Dashboard",
      "CRM & Marketing",
      "Queue Management",
      "Appointments",
      "Patients",
      "Doctors",
      "Settings",
    ],
    actions: [
      "patients:create",
      "patients:edit",
      "appointments:create",
      "appointments:reschedule",
      "appointments:generate-bill",
      "queue:notes",
      "queue:prescription",
      "queue:check-in",
      "queue:status-change",
      "doctors:manage",
      "billing:view",
      "crm:access",
    ],
  },
  doctor: {
    label: "Doctor",
    description: "Queue, appointments & patient consultations",
    allowedRoutes: [
      "/queue",
      "/appointments",
      "/patients",
      "/patients/:id",
    ],
    defaultRoute: "/queue",
    sidebarItems: [
      "Queue Management",
      "Appointments",
      "Patients",
    ],
    actions: [
      "queue:notes",
      "queue:prescription",
      "queue:status-change",
      "appointments:reschedule",
    ],
  },
  receptionist: {
    label: "Receptionist",
    description: "Scheduling, patients, queue & billing",
    allowedRoutes: [
      "/dashboard",
      "/queue",
      "/appointments",
      "/patients",
      "/patients/:id",
    ],
    defaultRoute: "/dashboard",
    sidebarItems: [
      "Dashboard",
      "Queue Management",
      "Appointments",
      "Patients",
    ],
    actions: [
      "patients:create",
      "patients:edit",
      "appointments:create",
      "appointments:reschedule",
      "appointments:generate-bill",
      "queue:check-in",
      "queue:status-change",
      "billing:view",
    ],
  },
};

/** Check if a given path is allowed for the role */
export function isRouteAllowed(role: Role, path: string): boolean {
  const config = ROLE_CONFIGS[role];
  return config.allowedRoutes.some((route) => {
    // Convert route patterns like /patients/:id to regex
    const pattern = route.replace(/:[^/]+/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(path);
  });
}

/** Check if the role has a specific action permission */
export function hasAction(role: Role, action: Action): boolean {
  return ROLE_CONFIGS[role].actions.includes(action);
}
