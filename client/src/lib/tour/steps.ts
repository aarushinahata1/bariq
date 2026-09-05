import type { DriveStep } from "driver.js";
import type { Role } from "@/lib/roles";

const sidebarSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar-brand"]',
    popover: {
      title: "Welcome to BariQ",
      description: "Here's a 60-second tour of where everything lives.",
      side: "right",
    },
  },
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: "Your menu",
      description: "This adapts to your role — you'll only ever see what you have access to.",
      side: "right",
    },
  },
];

const adminExtraSidebarStep: DriveStep = {
  element: '[data-tour="sidebar-role-badge"]',
  popover: {
    title: "Preview as another role",
    description: "As an admin, click here to see exactly what a doctor, receptionist, or pharmacist sees — without changing your own access.",
    side: "top",
  },
};

const receptionistNavCallout: DriveStep = {
  element: '[data-tour="sidebar-nav"]',
  popover: {
    title: "Queue Management is home base",
    description: "Checking patients in and moving them through their visit happens here — you'll likely have this open most of the day.",
    side: "right",
  },
};

const dashboardSteps: DriveStep[] = [
  {
    element: '[data-tour="dashboard-range-switcher"]',
    popover: {
      title: "Pick a time range",
      description: "Switch between Today, this Week, this Month, or All Time to see how the clinic is doing.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: "At-a-glance stats",
      description: "Patients seen, average wait time, and revenue for the selected range.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="dashboard-volume-chart"]',
    popover: {
      title: "Patient volume",
      description: "Track trends over time to spot your busiest days.",
      side: "top",
    },
  },
];

const doctorConsoleSteps: DriveStep[] = [
  {
    element: '[data-tour="console-doctor-select"]',
    popover: {
      title: "Pick a doctor",
      description: "If you cover multiple doctors, switch between their queues here.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="console-current-patient"]',
    popover: {
      title: "Current patient",
      description: "The patient currently being seen, with their vitals and history at a glance.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="console-prescription-panel"]',
    popover: {
      title: "Write a prescription",
      description: "Build and print a digital prescription right from here.",
      side: "top",
    },
  },
];

const pharmacySteps: DriveStep[] = [
  {
    element: '[data-tour="pharmacy-tabs"]',
    popover: {
      title: "Pharmacy modules",
      description: "Inventory, billing, suppliers, wastage, returns, and day-closing all live in these tabs.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="pharmacy-alerts-tab"]',
    popover: {
      title: "Check alerts first",
      description: "Low-stock and expiring-soon items show up here — worth a glance every shift.",
      side: "bottom",
    },
  },
];

export function getTourSteps(role: Role): DriveStep[] {
  switch (role) {
    case "admin":
      return [...sidebarSteps, adminExtraSidebarStep, ...dashboardSteps];
    case "receptionist":
      return [...sidebarSteps, receptionistNavCallout, ...dashboardSteps];
    case "doctor":
      return [...sidebarSteps, ...doctorConsoleSteps];
    case "pharmacist":
      return [...sidebarSteps, ...pharmacySteps];
  }
}

export function getTourId(role: Role): string {
  return `${role}-core`;
}
