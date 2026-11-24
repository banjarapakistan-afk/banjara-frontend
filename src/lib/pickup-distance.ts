/** Distance from a customer to a ride's pickup, worded the same in the panel and on the map. */

type Point = { lat: number; lng: number };

/** Within this distance the customer is treated as already at the pickup. */
export const AT_PICKUP_KM = 0.1;

/** Straight-line km between two points (haversine). */
export function straightKm(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** 0.35 -> "350 m", 8.66 -> "8.7 km", 12 -> "12 km". */
export function kmText(km: number) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1).replace(/\.0$/, "")} km`;
}

/** 7 -> "7 min", 135 -> "2 h 15 min", 120 -> "2 h". */
export function minutesText(min: number) {
  const rounded = Math.max(1, Math.round(min));
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export type PickupDistance = {
  atPickup: boolean;
  /** The road distance is still being looked up. */
  loading: boolean;
  /** "8.7 km by road · about 7 min drive" */
  headline: string;
  /** "5.9 km in a straight line" (or a status line). */
  detail: string;
};

/**
 * By road (with drive time) once the route is in; the straight line until then, or when
 * routing is unavailable.
 */
export function pickupDistance(
  from: Point,
  pickup: Point,
  road: { distanceKm: number; durationMin: number } | null,
  loadingRoad: boolean,
): PickupDistance {
  const straight = straightKm(from, pickup);
  if (straight < AT_PICKUP_KM || (road && road.distanceKm < AT_PICKUP_KM)) {
    return { atPickup: true, loading: false, headline: "You’re at the pickup point", detail: "No travel needed" };
  }
  if (road) {
    return {
      atPickup: false,
      loading: false,
      headline: `${kmText(road.distanceKm)} by road · about ${minutesText(road.durationMin)} drive`,
      detail: `${kmText(straight)} in a straight line`,
    };
  }
  return {
    atPickup: false,
    loading: loadingRoad,
    headline: `${kmText(straight)} away in a straight line`,
    detail: loadingRoad ? "Working out the road distance…" : "Road distance unavailable",
  };
}
