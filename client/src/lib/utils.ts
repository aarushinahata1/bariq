import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Converts a "YYYY-MM-DD" calendar date (as picked in a <input type="date">) into the
// UTC instant at that IST time-of-day — independent of the browser's own timezone.
// Booking/rescheduling code must use this instead of `new Date(y, mo - 1, d, ...)`,
// which builds the date in the BROWSER's local timezone: if that isn't IST, the
// resulting instant can land on the wrong side of the server's IST-midnight day
// boundary (dayRangeIST/istDayRange in server/routes.ts) — e.g. a same-day booking
// getting misread as "yesterday," making the patient's queue link show as expired
// right after they were booked.
export function istDateToInstant(dateStr: string, hour = 9, minute = 0): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hour, minute) - IST_OFFSET_MS);
}
