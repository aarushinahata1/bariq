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
  partnerId?: number | null;
  createdAt?: string | null;
}

interface Partner {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  referralCode: string;
  commissionPercent: number;
  status: "pending" | "active" | "inactive";
  createdAt?: string | null;
}

interface AuthState {
  clinic: Clinic | null;
  partner: Partner | null;
  isSuperAdmin: boolean;
  isPartner: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  clinic: null,
  partner: null,
  isSuperAdmin: false,
  isPartner: false,
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
  const isPartner = (data as any)?.isPartner === true;
  const clinic = isSuperAdmin || isPartner ? null : (data as Clinic | null) ?? null;
  const partner = isPartner ? (data as Partner) : null;

  const value: AuthState = {
    clinic,
    partner,
    isSuperAdmin,
    isPartner,
    isLoading,
    isAuthenticated: isSuperAdmin || isPartner || clinic !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
