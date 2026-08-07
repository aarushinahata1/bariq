import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import type { InsertUser, DoctorProfile } from "@shared/schema";

export function useDoctors() {
  return useQuery({
    queryKey: [api.doctors.list.path],
    queryFn: async () => {
      const res = await fetch(api.doctors.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return api.doctors.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertUser & { doctorProfile?: Partial<DoctorProfile> }) => {
      const res = await fetch(api.doctors.create.path, {
        method: api.doctors.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create doctor");
      return api.doctors.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.doctors.list.path] });
    },
  });
}

export function useUpdateDoctorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DoctorProfile> }) => {
      const url = buildUrl(api.doctors.updateProfile.path, { id });
      const res = await fetch(url, {
        method: api.doctors.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return api.doctors.updateProfile.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.doctors.list.path] });
      // Availability/consult-time changes affect Dashboard's "Active Doctor Queues"
      // widget and any appointment views that show per-doctor wait estimates.
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}

export function useDeleteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/doctors/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete doctor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.doctors.list.path] });
      // Deleting a doctor cancels their upcoming appointments server-side — without
      // this, Appointments/Dashboard keep showing them as still booked.
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}

export function useNotifyDelay() {
  return useMutation({
    mutationFn: async ({ id, delayMinutes, reason }: { id: string; delayMinutes: number; reason: string }) => {
      const url = buildUrl(api.doctors.notifyDelay.path, { id });
      const res = await fetch(url, {
        method: api.doctors.notifyDelay.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayMinutes, reason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send notifications");
      return api.doctors.notifyDelay.responses[200].parse(await res.json());
    },
  });
}
