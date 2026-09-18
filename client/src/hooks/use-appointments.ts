import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import type { InsertAppointment } from "@shared/schema";

export function useAppointments(
  filters?: { date?: string; doctorId?: string; status?: string; patientId?: number; from?: string; to?: string },
  options?: { refetchInterval?: number | false; keepPrevious?: boolean }
) {
  return useQuery({
    queryKey: [api.appointments.list.path, filters],
    queryFn: async () => {
      let url = api.appointments.list.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.date) params.append("date", filters.date);
        if (filters.doctorId) params.append("doctorId", filters.doctorId);
        if (filters.status) params.append("status", filters.status);
        if (filters.patientId) params.append("patientId", String(filters.patientId));
        // Explicit window so the server returns just this view's range instead of
        // falling back to its default recent window.
        if (filters.from) params.append("from", filters.from);
        if (filters.to) params.append("to", filters.to);
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return api.appointments.list.responses[200].parse(await res.json());
    },
    // SSE (see Queue.tsx / DoctorConsole.tsx) pushes queue changes the moment they
    // happen, so this timer is a fallback for a dropped stream, not the primary path.
    // Every tick costs a request and a multi-table query per open tab.
    refetchInterval: options?.refetchInterval ?? 120000,
    // Switching tabs/pages shouldn't refire the query when we just fetched it.
    staleTime: 15000,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.appointments.create.path, {
        method: api.appointments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to create appointment");
      }
      return api.appointments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      // Patients page renders a "Last Status" badge derived from appointment status —
      // without this it sticks on the previous value until an unrelated refetch.
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const url = buildUrl(api.appointments.update.path, { id });
      const res = await fetch(url, {
        method: api.appointments.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update appointment");
      return api.appointments.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      // Patients page renders a "Last Status" badge derived from appointment status —
      // without this it sticks on the previous value until an unrelated refetch.
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await res.json();
          throw new Error(error.message || "Failed to delete appointment");
        }
        throw new Error("Failed to delete appointment");
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      // Patients page renders a "Last Status" badge derived from appointment status —
      // without this it sticks on the previous value until an unrelated refetch.
      queryClient.invalidateQueries({ queryKey: [api.patients.list.path] });
    },
  });
}
