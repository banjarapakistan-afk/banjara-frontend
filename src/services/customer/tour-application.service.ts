import { customerGet, customerPost, customerPut } from "@/lib/customer-api";

/* Tour operator onboarding on the web: a company profile (ProviderProfile.tourDetails + logo)
   and a first real tour (TourItinerary), which BANJARA reviews before it is published. */

export type TourType = "trek" | "expedition" | "summit";
export type TourDifficulty = "easy" | "moderate" | "hard";
export type TourDay = { dayNumber: number; title: string; description: string };

export type TourCompany = {
  companyName: string;
  logo: string;
  description: string;
  yearsExperience?: number;
  operatingAreas: string[];
  specialties: string[];
  languages: string[];
  licence: string;
  images: string[];
};

export type TourItinerary = {
  id?: string;
  title: string;
  tourType: TourType;
  summary: string;
  description: string;
  destination: string;
  durationDays: number;
  durationNights?: number;
  difficulty?: TourDifficulty;
  maxParticipants: number;
  pricePerPerson: number;
  included: string[];
  excluded: string[];
  days: TourDay[];
  coverImage: string;
  images: string[];
  departureLocation?: string;
  bestSeason?: string;
  status?: "draft" | "pending" | "published" | "rejected";
  rejectionReason?: string;
};

export type MyTourApplication = {
  company: TourCompany;
  /** The newest tour, used as "your first tour" during signup. */
  tour: TourItinerary | null;
  tourCount: number;
  /** Raw tourDetails, kept so a save never drops fields this page does not edit. */
  rawTourDetails: Record<string, unknown>;
  city: string;
  businessName: string;
};

const LICENCE_PREFIX = "Tourism licence: ";
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);

function toTour(raw: Record<string, unknown>): TourItinerary {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    title: text(raw.title),
    tourType: (["trek", "expedition", "summit"].includes(text(raw.tourType)) ? text(raw.tourType) : "trek") as TourType,
    summary: text(raw.summary),
    description: text(raw.description),
    destination: text(raw.destination),
    durationDays: Math.max(1, Number(raw.durationDays) || 1),
    durationNights: raw.durationNights != null ? Number(raw.durationNights) : undefined,
    difficulty: (["easy", "moderate", "hard"].includes(text(raw.difficulty)) ? text(raw.difficulty) : undefined) as TourDifficulty | undefined,
    maxParticipants: Math.max(1, Number(raw.maxParticipants) || 1),
    pricePerPerson: Math.max(0, Number(raw.pricePerPerson) || 0),
    included: list(raw.included),
    excluded: list(raw.excluded),
    days: Array.isArray(raw.days)
      ? (raw.days as Array<Record<string, unknown>>).map((d, i) => ({
          dayNumber: Number(d.dayNumber) || i + 1,
          title: text(d.title),
          description: text(d.description),
        }))
      : [],
    coverImage: text(raw.coverImage),
    images: list(raw.images),
    departureLocation: text(raw.departureLocation) || undefined,
    bestSeason: text(raw.bestSeason) || undefined,
    status: text(raw.status) as TourItinerary["status"],
    rejectionReason: text(raw.rejectionReason) || undefined,
  };
}

export async function getMyTourApplication(): Promise<MyTourApplication> {
  const [profile, mine] = await Promise.all([
    customerGet<Record<string, unknown>>("/providers/me"),
    customerGet<unknown>("/tour-itineraries/mine").catch(() => []),
  ]);
  const t = (profile.tourDetails ?? {}) as Record<string, unknown>;
  const certs = list(t.certifications);
  const tours = (Array.isArray(mine) ? mine : Array.isArray((mine as { items?: unknown })?.items) ? (mine as { items: unknown[] }).items : []) as Array<Record<string, unknown>>;
  // Newest first, so the tour being built in signup is the one shown.
  const sorted = [...tours].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return {
    company: {
      companyName: text(t.companyName) || text(profile.businessName),
      logo: text(profile.logo),
      description: text(t.description) || text(profile.description),
      yearsExperience: t.yearsExperience != null ? Number(t.yearsExperience) : Number(profile.yearsExperience) || undefined,
      operatingAreas: list(t.operatingAreas),
      specialties: list(t.specialties),
      languages: [...new Set([...list(t.internationalLanguages), ...list(t.regionalLanguages)])],
      licence: (certs.find((c) => c.startsWith(LICENCE_PREFIX)) ?? "").slice(LICENCE_PREFIX.length),
      images: list(t.images),
    },
    tour: sorted[0] ? toTour(sorted[0]) : null,
    tourCount: sorted.length,
    rawTourDetails: t,
    city: text(profile.city),
    businessName: text(profile.businessName),
  };
}

/** Saves the company profile, keeping any tourDetails fields this page does not edit. */
export async function saveTourCompany(company: TourCompany, raw: Record<string, unknown>, tour?: TourItinerary | null) {
  const otherCerts = list(raw.certifications).filter((c) => !c.startsWith(LICENCE_PREFIX));
  await customerPut("/providers/me", {
    logo: company.logo || "",
    yearsExperience: company.yearsExperience ?? 0,
    description: company.description,
    tourDetails: {
      ...raw,
      companyName: company.companyName,
      description: company.description,
      yearsExperience: company.yearsExperience,
      operatingAreas: company.operatingAreas,
      specialties: company.specialties,
      internationalLanguages: company.languages,
      regionalLanguages: [],
      certifications: company.licence.trim() ? [...otherCerts, `${LICENCE_PREFIX}${company.licence.trim()}`] : otherCerts,
      images: company.images,
      // Older catalog cards read these from the profile; keep them in step with the first tour.
      ...(tour
        ? {
            tourName: tour.title,
            destination: tour.destination,
            duration: `${tour.durationDays} day${tour.durationDays === 1 ? "" : "s"}`,
            departureLocation: tour.departureLocation ?? "",
            price: tour.pricePerPerson,
            maxParticipants: tour.maxParticipants,
            included: tour.included,
            excluded: tour.excluded,
          }
        : {}),
    },
  });
}

/** Creates or updates the tour. `submit` sends it to BANJARA for review. */
export async function saveTour(tour: TourItinerary, submit = false): Promise<TourItinerary> {
  const body = {
    title: tour.title,
    tourType: tour.tourType,
    summary: tour.summary,
    description: tour.description,
    destination: tour.destination,
    durationDays: tour.durationDays,
    durationNights: tour.durationNights,
    difficulty: tour.difficulty,
    maxParticipants: tour.maxParticipants,
    pricePerPerson: tour.pricePerPerson,
    currency: "PKR",
    included: tour.included,
    excluded: tour.excluded,
    days: tour.days,
    coverImage: tour.coverImage,
    images: tour.images.length ? tour.images : [tour.coverImage],
    departureLocation: tour.departureLocation,
    bestSeason: tour.bestSeason,
    submitForReview: submit,
  };
  const saved = tour.id
    ? await customerPut<Record<string, unknown>>(`/tour-itineraries/${tour.id}`, body)
    : await customerPost<Record<string, unknown>>("/tour-itineraries", body);
  return toTour(saved ?? {});
}

/* ---------- What each step needs (the same rules in the app) ---------- */

export function companyMissing(c: TourCompany): string[] {
  const missing: string[] = [];
  if (c.companyName.trim().length < 2) missing.push("your company name");
  if (c.description.trim().length < 30) missing.push("a short company description (30+ characters)");
  if (!c.operatingAreas.length) missing.push("regions you operate in");
  if (!c.specialties.length) missing.push("the kind of tours you run");
  return missing;
}

export function tourMissing(t: TourItinerary): string[] {
  const missing: string[] = [];
  if (t.title.trim().length < 3) missing.push("a tour name");
  if (!t.destination.trim()) missing.push("the destination");
  if (t.summary.trim().length < 10) missing.push("a one-line summary (10+ characters)");
  if (!(t.pricePerPerson > 0)) missing.push("the price per person");
  if (!(t.maxParticipants >= 1)) missing.push("the group size");
  if (!t.coverImage) missing.push("a cover photo");
  if (t.days.some((d) => !d.title.trim())) missing.push("a title for every day of the plan");
  return missing;
}

/** The API needs a 20+ character description; build one from the plan when it's left empty. */
export function descriptionFor(t: TourItinerary) {
  if (t.description.trim().length >= 20) return t.description.trim();
  const plan = t.days.map((d) => `Day ${d.dayNumber}: ${d.title}${d.description ? ` — ${d.description}` : ""}`).join("\n");
  return [t.summary.trim(), plan].filter(Boolean).join("\n\n").padEnd(20, ".");
}
