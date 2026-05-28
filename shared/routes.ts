import { z } from 'zod';
import {
  insertUserSchema,
  insertPatientSchema,
  insertAppointmentSchema,
  insertDoctorProfileSchema,
  users,
  patients,
  appointments,
  doctorProfiles,
  notifications
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  patients: {
    list: {
      method: 'GET' as const,
      path: '/api/patients',
      input: z.object({ search: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof patients.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/patients',
      input: insertPatientSchema,
      responses: {
        201: z.custom<typeof patients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/patients/:id',
      responses: {
        200: z.custom<typeof patients.$inferSelect & { appointments: typeof appointments.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
  },

  doctors: {
    list: {
      method: 'GET' as const,
      path: '/api/doctors',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect & { doctorProfile: typeof doctorProfiles.$inferSelect | null }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/doctors',
      input: insertUserSchema.extend({
        doctorProfile: insertDoctorProfileSchema.omit({ userId: true }).optional()
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateProfile: {
      method: 'PUT' as const,
      path: '/api/doctors/:id/profile',
      input: insertDoctorProfileSchema.partial(),
      responses: {
        200: z.custom<typeof doctorProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    notifyDelay: {
      method: 'POST' as const,
      path: '/api/doctors/:id/delay',
      input: z.object({ delayMinutes: z.number(), reason: z.string() }),
      responses: {
        200: z.object({ success: z.boolean(), notifiedCount: z.number() }),
      },
    },
  },

  appointments: {
    list: {
      method: 'GET' as const,
      path: '/api/appointments',
      input: z.object({
        date: z.string().optional(),
        doctorId: z.string().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof appointments.$inferSelect & { patient: typeof patients.$inferSelect, doctor: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/appointments',
      input: insertAppointmentSchema,
      responses: {
        201: z.custom<typeof appointments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/appointments/:id',
      input: insertAppointmentSchema.partial().extend({
        status: z.enum(["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"]).optional()
      }),
      responses: {
        200: z.custom<typeof appointments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats',
      responses: {
        200: z.object({
          dailyPatients: z.number(),
          completedToday: z.number(),
          avgWaitTime: z.number(),
          totalRevenue: z.number(),
          totalPending: z.number(),
          totalCollected: z.number(),
          weeklyData: z.array(z.object({
            date: z.string(),
            patients: z.number(),
            avgWait: z.number(),
            revenue: z.number(),
          })),
          activeQueues: z.array(z.object({
            doctorId: z.string(),
            doctorName: z.string().nullable(),
            waitingCount: z.number(),
            currentWaitTime: z.number()
          })),
          sourceDistribution: z.array(z.object({
            name: z.string(),
            value: z.number(),
          })),
        }),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
