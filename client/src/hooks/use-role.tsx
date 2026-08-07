import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Role, Action, ROLE_CONFIGS, isRouteAllowed, hasAction } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

interface RoleContextValue {
  /** Effective role for rendering — the real session role, unless an admin is previewing another one. */
  role: Role;
  /** The real, server-verified role for this session. Never affected by preview. */
  realRole: Role;
  isAdmin: boolean;
  /** True only when realRole is admin AND a preview role is active. */
  isPreviewing: boolean;
  /** Admin-only, no-ops for everyone else. Pass null to exit preview. */
  setPreviewRole: (role: Role | null) => void;
  canAccess: (path: string) => boolean;
  can: (action: Action) => boolean;
  config: typeof ROLE_CONFIGS[Role];
}

const RoleContext = createContext<RoleContextValue | null>(null);

const PREVIEW_STORAGE_KEY = "medqueue-role-preview";

function getStoredPreview(): Role | null {
  try {
    const stored = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (stored && stored in ROLE_CONFIGS) return stored as Role;
  } catch {}
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  // realRole is unrecognized (null) only in edge cases — e.g. a generic "staff"
  // catch-all DB role with no dedicated permission set. Falling back to the most
  // restrictive assignable role here (never "admin") keeps that fail-safe.
  const { role: authRole } = useAuth();
  const realRole: Role = authRole ?? "receptionist";
  const isAdmin = realRole === "admin";

  const [previewRole, setPreviewRoleState] = useState<Role | null>(() => (isAdmin ? getStoredPreview() : null));

  const setPreviewRole = useCallback((next: Role | null) => {
    // Only real admins can preview — this only ever changes what THIS browser
    // renders; it can never grant extra API access since the server enforces
    // realRole regardless of what's previewed here.
    if (realRole !== "admin") return;
    setPreviewRoleState(next);
    try {
      if (next) sessionStorage.setItem(PREVIEW_STORAGE_KEY, next);
      else sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {}
  }, [realRole]);

  const role: Role = isAdmin && previewRole ? previewRole : realRole;
  const isPreviewing = isAdmin && previewRole !== null;

  const canAccess = useCallback(
    (path: string) => isRouteAllowed(role, path),
    [role]
  );

  const can = useCallback(
    (action: Action) => hasAction(role, action),
    [role]
  );

  return (
    <RoleContext.Provider value={{ role, realRole, isAdmin, isPreviewing, setPreviewRole, canAccess, can, config: ROLE_CONFIGS[role] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
