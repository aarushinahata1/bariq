import { useCallback } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

function seenKey(userId: string, tourId: string) {
  return `medqueue-tour-seen:${userId}:${tourId}`;
}

export function hasSeenTour(userId: string, tourId: string): boolean {
  try {
    return localStorage.getItem(seenKey(userId, tourId)) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(userId: string, tourId: string) {
  try {
    localStorage.setItem(seenKey(userId, tourId), new Date().toISOString());
  } catch {}
}

/** Drops any step whose target isn't currently rendered, so conditional UI (empty queue, no active patient) doesn't break the tour. */
function presentSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    const selector = typeof step.element === "string" ? step.element : undefined;
    return !selector || document.querySelector(selector) !== null;
  });
}

export function useTour() {
  const start = useCallback(
    (userId: string, tourId: string, steps: DriveStep[]) => {
      const liveSteps = presentSteps(steps);
      if (liveSteps.length === 0) return;

      const tourDriver = driver({
        showProgress: true,
        allowClose: true,
        popoverClass: "medqueue-tour-popover",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        steps: liveSteps,
        onDestroyed: () => markTourSeen(userId, tourId),
      });

      tourDriver.drive();
    },
    []
  );

  return { start, hasSeenTour, markTourSeen };
}
