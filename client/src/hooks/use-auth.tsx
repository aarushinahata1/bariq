import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface Clinic {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  planStatus: "trial" | "active" | "expired" | "cancelled";
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  createdAt?: string | null;
}

interface AuthState {
  clinic: Clinic | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  clinic: null,
  isSuperAdmin: false,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const isSuperAdmin = (data as any)?.isSuperAdmin === true;
  const clinic = isSuperAdmin ? null : (data as Clinic | null) ?? null;

  const value: AuthState = {
    clinic,
    isSuperAdmin,
    isLoading,
    isAuthenticated: isSuperAdmin || clinic !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
