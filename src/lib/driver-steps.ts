import type { DriverStep, LodgingStep } from "@/services/customer/auth.service";

type StepDef<K extends string> = { key: K | "account" | "service"; label: string; path?: string };

/** The local-driver application, in order. `path` is set once a step has a web page. */
export const DRIVER_STEPS: Array<StepDef<DriverStep>> = [
  { key: "account", label: "Create account" },
  { key: "service", label: "Choose service", path: "/provider-application" },
  { key: "business", label: "Your details", path: "/provider-application" },
  { key: "location", label: "Your location", path: "/provider-application/location" },
  { key: "transport", label: "You & your vehicle", path: "/provider-application/vehicle" },
  { key: "vehicle", label: "Vehicle setup", path: "/provider-application/vehicle-setup" },
  { key: "verification", label: "Verify your CNIC", path: "/provider-application/cnic" },
  { key: "review", label: "Review & submit", path: "/provider-application/review" },
];

/** The lodging (hotel, guest house, lodge, hostel) application, in order. */
export const LODGING_STEPS: Array<StepDef<LodgingStep>> = [
  { key: "account", label: "Create account" },
  { key: "service", label: "Choose service", path: "/provider-application" },
  { key: "business", label: "Your details", path: "/provider-application" },
  { key: "location", label: "Property location", path: "/provider-application/location" },
  { key: "property", label: "Property details", path: "/provider-application/property" },
  { key: "photos", label: "Photos", path: "/provider-application/photos" },
  { key: "rooms", label: "Rooms", path: "/provider-application/rooms" },
  { key: "review", label: "Review & submit", path: "/provider-application/review" },
];

/** The travel guide application, in order. Steps 4–8 are one page with a `?step=` tab. */
export type GuideStep = "profile" | "services" | "schedule" | "photos" | "review";
export const GUIDE_STEPS: Array<StepDef<"business" | GuideStep>> = [
  { key: "account", label: "Create account" },
  { key: "service", label: "Choose service", path: "/provider-application" },
  { key: "business", label: "Your details", path: "/provider-application" },
  { key: "profile", label: "Guide profile", path: "/provider-application/guide?step=profile" },
  { key: "services", label: "Services & prices", path: "/provider-application/guide?step=services" },
  { key: "schedule", label: "Availability", path: "/provider-application/guide?step=schedule" },
  { key: "photos", label: "Photos & documents", path: "/provider-application/guide?step=photos" },
  { key: "review", label: "Review & submit", path: "/provider-application/guide?step=review" },
];
export const GUIDE_STEP_TOTAL = GUIDE_STEPS.length;

/** The tour operator application. Steps 4–6 are one page with a `?step=` tab. */
export type TourStep = "company" | "tour" | "review";
export const TOUR_STEPS: Array<StepDef<"business" | TourStep>> = [
  { key: "account", label: "Create account" },
  { key: "service", label: "Choose service", path: "/provider-application" },
  { key: "business", label: "Your details", path: "/provider-application" },
  { key: "company", label: "Company profile", path: "/provider-application/tours?step=company" },
  { key: "tour", label: "Your first tour", path: "/provider-application/tours?step=tour" },
  { key: "review", label: "Review & submit", path: "/provider-application/tours?step=review" },
];
export const TOUR_STEP_TOTAL = TOUR_STEPS.length;

/** The restaurant application. Steps 5–7 are one page with a `?step=` tab. */
export type RestaurantStep = "profile" | "menu" | "review";
export const RESTAURANT_STEPS: Array<StepDef<"business" | "location" | RestaurantStep>> = [
  { key: "account", label: "Create account" },
  { key: "service", label: "Choose service", path: "/provider-application" },
  { key: "business", label: "Your details", path: "/provider-application" },
  { key: "location", label: "Restaurant location", path: "/provider-application/location" },
  { key: "profile", label: "Your restaurant", path: "/provider-application/restaurant?step=profile" },
  { key: "menu", label: "Menu & offers", path: "/provider-application/restaurant?step=menu" },
  { key: "review", label: "Review & submit", path: "/provider-application/restaurant?step=review" },
];
export const RESTAURANT_STEP_TOTAL = RESTAURANT_STEPS.length;

export const DRIVER_STEP_TOTAL = DRIVER_STEPS.length;
export const LODGING_STEP_TOTAL = LODGING_STEPS.length;

/** 1-based step number shown in the progress bar. */
export function driverStepNumber(key: (typeof DRIVER_STEPS)[number]["key"]): number {
  return DRIVER_STEPS.findIndex((step) => step.key === key) + 1;
}

export function lodgingStepNumber(key: (typeof LODGING_STEPS)[number]["key"]): number {
  return LODGING_STEPS.findIndex((step) => step.key === key) + 1;
}

/** Web page for a step, or null while that step is only in the app. */
export function driverStepHref(key: string | undefined): string | null {
  if (!key) return null;
  return DRIVER_STEPS.find((step) => step.key === key)?.path ?? null;
}

export function lodgingStepHref(key: string | undefined): string | null {
  if (!key) return null;
  return LODGING_STEPS.find((step) => step.key === key)?.path ?? null;
}

/**
 * The page before `key` in a flow, for the "Back" link on each step.
 * Going back to "Your details" opens it in edit mode and returns to this step after saving.
 */
export function previousStep(
  flow: "driver" | "lodging" | "guide" | "tour" | "restaurant",
  key: string,
): { href: string; label: string } | undefined {
  const steps = (flow === "driver" ? DRIVER_STEPS : flow === "guide" ? GUIDE_STEPS : flow === "tour" ? TOUR_STEPS : flow === "restaurant" ? RESTAURANT_STEPS : LODGING_STEPS) as Array<StepDef<string>>;
  const index = steps.findIndex((step) => step.key === key);
  if (index <= 0) return undefined;
  const prev = steps[index - 1];
  const current = steps[index];
  if (!prev.path || prev.key === "service") return undefined;
  if (prev.key === "business") {
    const back = current.path ? `&return=${encodeURIComponent(current.path)}` : "";
    return { href: `/provider-application?edit=details${back}`, label: prev.label };
  }
  return { href: prev.path, label: prev.label };
}

/** The steps for whichever service this application is for (null: not on the web). */
export function applicationSteps(services: string[] | undefined) {
  if (services?.includes("transport")) return DRIVER_STEPS as Array<StepDef<string>>;
  if (services?.includes("hotel")) return LODGING_STEPS as Array<StepDef<string>>;
  if (services?.includes("travelGuide")) return GUIDE_STEPS as Array<StepDef<string>>;
  if (services?.includes("tour")) return TOUR_STEPS as Array<StepDef<string>>;
  if (services?.includes("restaurant")) return RESTAURANT_STEPS as Array<StepDef<string>>;
  return null;
}

/** Page for an application's next step, whatever its service. */
export function nextStepHref(
  application: { services: string[]; progress?: { nextStep: string }; location?: unknown } | null | undefined,
) {
  // Guides have no server-side progress: the guide page works out its own next tab
  // (and sends a submitted guide to their dashboard).
  if (application?.services.includes("travelGuide")) return "/provider-application/guide";
  if (application?.services.includes("tour")) return "/provider-application/tours";
  // Restaurants pin their entrance first, then fill in the restaurant tabs.
  if (application?.services.includes("restaurant"))
    return application.location ? "/provider-application/restaurant" : "/provider-application/location";
  if (!application?.progress) return null;
  const steps = applicationSteps(application.services);
  return steps?.find((step) => step.key === application.progress!.nextStep)?.path ?? null;
}
