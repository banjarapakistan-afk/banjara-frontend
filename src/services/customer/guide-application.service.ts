import { customerGet, customerPut } from "@/lib/customer-api";

/* Guide onboarding on the web. Mirrors ProviderProfile.guideDetails and the app's guide wizard.
   PUT /guides/me/profile merges what is sent with what is saved, so each step sends only its part. */

export type GuideType =
  | "local"
  | "tour"
  | "trekking"
  | "hiking"
  | "cultural"
  | "adventure"
  | "mountain"
  | "photography"
  | "other";
export type LanguageProficiency = "basic" | "conversational" | "fluent" | "native";
export type GuidePricingType = "per_person" | "per_group" | "per_hour" | "per_day" | "custom";
export type GuideDocumentType = "cnic" | "guide_license" | "tourism_cert" | "first_aid" | "mountain_cert" | "other";
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type GuideLanguage = { language: string; proficiency: LanguageProficiency };
export type GuideDocument = {
  id: string;
  type: GuideDocumentType;
  number?: string;
  expiryDate?: string;
  fileUrl: string;
  status: "pending" | "verified" | "rejected" | "expired";
};
export type GuidePhoto = { id: string; url: string; category: string; caption?: string };
export type GuideService = {
  id: string;
  name: string;
  category: GuideType;
  description: string;
  durationLabel: string;
  durationHours?: number;
  price: number;
  pricingType: GuidePricingType;
  currency: string;
  minGuests: number;
  maxGuests: number;
  included: string[];
  excluded: string[];
  meetingPoint?: string;
  availableLocations: string[];
  active: boolean;
};
export type GuideDay = { day: Weekday; enabled: boolean; startTime: string; endTime: string };
export type GuideAvailability = {
  weekly: GuideDay[];
  advanceBookingHours?: number;
  blockedDates: string[];
};

export type GuideDetails = {
  profileStatus?: "draft" | "pending" | "changes_requested" | "approved" | "rejected" | "suspended";
  changesRequestedNote?: string;
  fullName?: string;
  profilePhoto?: string;
  phone?: string;
  email?: string;
  city?: string;
  areasCovered?: string[];
  guideTypes?: GuideType[];
  yearsExperience?: number;
  shortBio?: string;
  detailedDescription?: string;
  specialSkills?: string[];
  certifications?: string[];
  languages?: GuideLanguage[];
  documents?: GuideDocument[];
  photos?: GuidePhoto[];
  services?: GuideService[];
  availability?: GuideAvailability;
  dailyHireRate?: number;
};

export type MyGuide = {
  providerId: string;
  verificationStatus: string;
  guide: GuideDetails;
  /** Account-level fallbacks from "Your details" (step 3). */
  ownerName: string;
  city: string;
};

export const WEEKDAYS: Array<{ day: Weekday; label: string }> = [
  { day: "monday", label: "Monday" },
  { day: "tuesday", label: "Tuesday" },
  { day: "wednesday", label: "Wednesday" },
  { day: "thursday", label: "Thursday" },
  { day: "friday", label: "Friday" },
  { day: "saturday", label: "Saturday" },
  { day: "sunday", label: "Sunday" },
];

/** Every day 09:00–18:00, the same default as the backend. */
export function defaultWeek(): GuideDay[] {
  return WEEKDAYS.map(({ day }) => ({ day, enabled: true, startTime: "09:00", endTime: "18:00" }));
}

const list = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];

export async function getMyGuide(): Promise<MyGuide> {
  const data = await customerGet<Record<string, unknown>>("/guides/me/profile");
  const g = (data.guideDetails ?? {}) as GuideDetails & Record<string, unknown>;
  const weekly = Array.isArray(g.availability?.weekly) && g.availability.weekly.length ? g.availability.weekly : defaultWeek();
  return {
    providerId: String(data.providerId ?? ""),
    verificationStatus: String(data.verificationStatus ?? "pending"),
    ownerName: String(data.ownerName ?? ""),
    city: String(data.city ?? ""),
    guide: {
      ...g,
      areasCovered: list(g.areasCovered),
      guideTypes: list(g.guideTypes) as GuideType[],
      specialSkills: list(g.specialSkills),
      certifications: list(g.certifications),
      languages: Array.isArray(g.languages) ? g.languages : [],
      documents: Array.isArray(g.documents) ? g.documents : [],
      photos: Array.isArray(g.photos) ? g.photos : [],
      services: Array.isArray(g.services) ? g.services : [],
      availability: {
        weekly,
        advanceBookingHours: g.availability?.advanceBookingHours,
        blockedDates: list(g.availability?.blockedDates),
      },
    },
  };
}

/** Saves part of the guide profile; `submit` sends it for BANJARA review. */
export async function saveGuide(patch: Partial<GuideDetails>, submit = false) {
  await customerPut("/guides/me/profile", { ...patch, ...(submit ? { submit: true } : {}) });
}

export const newGuideId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ---------- What each step needs (used for resume and the review page) ---------- */

export function profileMissing(g: GuideDetails): string[] {
  const missing: string[] = [];
  if (!g.profilePhoto) missing.push("a profile photo");
  if (!g.guideTypes?.length) missing.push("the kind of guiding you do");
  if (!g.areasCovered?.length) missing.push("areas you cover");
  if (!g.languages?.some((l) => l.language.trim())) missing.push("languages you speak");
  if ((g.shortBio ?? "").trim().length < 30) missing.push("a short bio (30+ characters)");
  return missing;
}

export function servicesMissing(g: GuideDetails): string[] {
  const hasService = (g.services ?? []).some((s) => s.active !== false);
  return hasService || (g.dailyHireRate ?? 0) > 0 ? [] : ["at least one service or a daily rate"];
}

export function scheduleMissing(g: GuideDetails): string[] {
  return (g.availability?.weekly ?? []).some((d) => d.enabled) ? [] : ["at least one day you can guide"];
}
