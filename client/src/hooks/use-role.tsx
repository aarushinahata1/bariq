import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Role, Action, ROLE_CONFIGS, isRouteAllowed, hasAction } from "@/lib/roles";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  canAccess: (path: string) => boolean;
  can: (action: Action) => boolean;
  config: typeof ROLE_CONFIGS[Role];
}

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = "medqueue-role";

function getStoredRole(): Role {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in ROLE_CONFIGS) return stored as Role;
  } catch {}
  return "admin";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(getStoredRole);

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
  }, []);

  const canAccess = useCallback(
    (path: string) => isRouteAllowed(role, path),
    [role]
  );

  const can = useCallback(
    (action: Action) => hasAction(role, action),
    [role]
  );

  return (
    <RoleContext.Provider value={{ role, setRole, canAccess, can, config: ROLE_CONFIGS[role] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
