import { customerGet, customerPut } from "@/lib/customer-api";

/* Restaurant onboarding on the web: ProviderProfile.restaurantDetails.
   PUT /providers/me replaces restaurantDetails as a whole, so saves merge with what is stored. */

export type OfferType = "discount" | "offer" | "sale";
export type RestaurantOffer = {
  id: string;
  title: string;
  type: OfferType;
  discountPercent?: number;
  description?: string;
  active: boolean;
};

export type RestaurantProfile = {
  restaurantName: string;
  description: string;
  cuisineTypes: string[];
  menuVariety: string[];
  images: string[];
  hours: string;
  offers: RestaurantOffer[];
};

export type MyRestaurantApplication = {
  restaurant: RestaurantProfile;
  raw: Record<string, unknown>;
  /** From "Your details" and the map pin: shown, not asked again. */
  businessName: string;
  phone: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  pinned: boolean;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);

export const newOfferId = () => `offer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export async function getMyRestaurantApplication(): Promise<MyRestaurantApplication> {
  const profile = await customerGet<Record<string, unknown>>("/providers/me");
  const r = (profile.restaurantDetails ?? {}) as Record<string, unknown>;
  const coords = (profile.location as { coordinates?: unknown } | undefined)?.coordinates;
  const [lng, lat] = Array.isArray(coords) ? coords.map(Number) : [];
  const pinned = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const structured = profile.structuredAddress as { formattedAddress?: string } | undefined;
  return {
    restaurant: {
      restaurantName: text(r.restaurantName) || text(profile.businessName),
      description: text(r.description) || text(profile.description),
      cuisineTypes: list(r.cuisineTypes),
      menuVariety: list(r.menuVariety),
      // Old app signups saved a stock photo when none was added; never show it as theirs.
      images: list(r.images).filter((u) => !/images\.unsplash\.com/.test(u)),
      hours: text(r.hours),
      offers: (Array.isArray(r.offers) ? (r.offers as Array<Record<string, unknown>>) : [])
        .filter((o) => text(o.title))
        .map((o) => ({
          id: text(o.id) || newOfferId(),
          title: text(o.title),
          type: (["discount", "offer", "sale"].includes(text(o.type)) ? text(o.type) : "offer") as OfferType,
          discountPercent: o.discountPercent != null ? Number(o.discountPercent) : undefined,
          description: text(o.description) || undefined,
          active: o.active !== false,
        })),
    },
    raw: r,
    businessName: text(profile.businessName),
    phone: text(profile.phone),
    city: text(profile.city),
    address: text(structured?.formattedAddress) || text(profile.address),
    latitude: pinned ? lat : undefined,
    longitude: pinned ? lng : undefined,
    pinned,
  };
}

/** Saves the restaurant, keeping fields this page doesn't edit, and mirroring the pin and phone. */
export async function saveRestaurant(app: MyRestaurantApplication, next: RestaurantProfile) {
  await customerPut("/providers/me", {
    description: next.description,
    restaurantDetails: {
      ...app.raw,
      restaurantName: next.restaurantName,
      description: next.description,
      cuisineTypes: next.cuisineTypes,
      menuVariety: next.menuVariety,
      images: next.images,
      hours: next.hours,
      offers: next.offers.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        discountPercent: o.type === "discount" ? o.discountPercent : undefined,
        description: o.description,
        active: o.active,
      })),
      city: app.city || text(app.raw.city),
      address: app.address || text(app.raw.address),
      phone: text(app.raw.phone) || app.phone,
      latitude: app.latitude ?? (app.raw.latitude as number | undefined),
      longitude: app.longitude ?? (app.raw.longitude as number | undefined),
    },
  });
}

/* ---------- Opening hours: a simple picker stored as one readable line ---------- */

export const HOUR_DAYS = ["Every day", "Mon–Sat", "Mon–Fri", "Weekends"] as const;
export type HoursValue = { days: string; open: string; close: string; allDay: boolean };

export function formatHours(h: HoursValue) {
  return h.allDay ? `${h.days} · Open 24 hours` : `${h.days} · ${h.open}–${h.close}`;
}

/** Reads "Every day · 08:00–23:00" back; anything else starts from a sensible default. */
export function parseHours(value: string): HoursValue {
  const match = value.match(/^(.+?)\s*·\s*(?:(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})|(Open 24 hours))$/);
  if (!match) return { days: "Every day", open: "09:00", close: "23:00", allDay: false };
  return { days: match[1], open: match[2] ?? "09:00", close: match[3] ?? "23:00", allDay: Boolean(match[4]) };
}

/* ---------- What each step needs (the same rules in the app) ---------- */

export function restaurantMissing(r: RestaurantProfile): string[] {
  const missing: string[] = [];
  if (r.restaurantName.trim().length < 2) missing.push("your restaurant name");
  if (!r.images.length) missing.push("at least one photo");
  if (!r.cuisineTypes.length) missing.push("the food you serve");
  if (r.description.trim().length < 30) missing.push("a short description (30+ characters)");
  if (!r.hours.trim()) missing.push("your opening hours");
  return missing;
}

export function menuMissing(r: RestaurantProfile): string[] {
  const missing: string[] = [];
  if (!r.menuVariety.length) missing.push("at least one dish travellers can order");
  const badOffer = r.offers.find((o) => o.type === "discount" && !(Number(o.discountPercent) > 0 && Number(o.discountPercent) <= 90));
  if (badOffer) missing.push(`a discount between 1 and 90% for “${badOffer.title}”`);
  return missing;
}
