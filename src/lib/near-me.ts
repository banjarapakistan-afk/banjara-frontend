/**
 * "Rides near me": the visitor's position and search radius, carried in the map URL as
 * `near=lat,lng&radius=km`. GET /api/discover applies the same parameters on the server.
 */
export const NEAR_DEFAULT_KM = 10;
export const NEAR_MAX_KM = 20;

export type NearMe = { lat: number; lng: number; radiusKm: number };

export function readNearMe(params: URLSearchParams): NearMe | null {
  const parts = (params.get("near") ?? "").split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const radius = Number(params.get("radius"));
  const radiusKm = Number.isFinite(radius) && radius > 0
    ? Math.min(NEAR_MAX_KM, Math.max(1, Math.round(radius)))
    : NEAR_DEFAULT_KM;
  return { lat, lng, radiusKm };
}

/** Where the "Ride" choice sends the visitor once their location is known. */
export function nearMeHref(lat: number, lng: number, radiusKm = NEAR_DEFAULT_KM) {
  const params = new URLSearchParams({
    service: "transport",
    near: `${lat.toFixed(5)},${lng.toFixed(5)}`,
    radius: String(radiusKm),
  });
  return `/explore/map?${params}`;
}

/** A box around the search circle, [[south, west], [north, east]], for fitting the map. */
export function nearBounds(near: NearMe): [[number, number], [number, number]] {
  const dLat = near.radiusKm / 111.32;
  const dLng = near.radiusKm / (111.32 * Math.max(0.2, Math.cos((near.lat * Math.PI) / 180)));
  return [
    [near.lat - dLat, near.lng - dLng],
    [near.lat + dLat, near.lng + dLng],
  ];
}

/**
 * Why we couldn't get a position:
 * - denied: the visitor (or the browser settings) blocked location for this site
 * - noanswer: the permission prompt was ignored, dismissed or never shown
 * - insecure: the page isn't on https/localhost, so browsers refuse to share location
 * - timeout / unavailable: allowed, but the device couldn't produce a position
 */
export type LocateFailure = "denied" | "noanswer" | "insecure" | "unavailable" | "timeout";

/** asking: the browser's permission prompt is up. locating: allowed, getting a fix. */
export type LocateStage = "asking" | "locating";

/** How long the permission prompt may sit unanswered before we offer help instead. */
const ASK_LIMIT_MS = 20_000;
/** How long the device gets to produce a position once allowed. */
const FIX_LIMIT_MS = 15_000;

/**
 * Ask the browser for the visitor's position (once; nothing is stored).
 *
 * The browser's own `timeout` only starts once permission is granted, so an unanswered or
 * silently dismissed prompt would otherwise wait forever. A watchdog here guarantees the
 * promise always settles, and `onStage` reports progress for the UI.
 */
export function locateVisitor(
  onStage?: (stage: LocateStage) => void,
): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      reject("unavailable" satisfies LocateFailure);
      return;
    }
    if (!window.isSecureContext) {
      reject("insecure" satisfies LocateFailure);
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let permission: PermissionStatus | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (permission) permission.onchange = null;
      fn();
    };
    const fail = (why: LocateFailure) => finish(() => reject(why));
    const stage = (next: LocateStage) => {
      if (settled) return;
      onStage?.(next);
      clearTimeout(timer);
      timer = setTimeout(
        () => fail(next === "asking" ? "noanswer" : "timeout"),
        next === "asking" ? ASK_LIMIT_MS : FIX_LIMIT_MS,
      );
    };

    const request = () =>
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish(() => resolve({ lat: position.coords.latitude, lng: position.coords.longitude })),
        (error) =>
          fail(
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable",
          ),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
      );

    // Where supported, know up front whether a prompt will appear (and follow its answer).
    const query = navigator.permissions?.query?.({ name: "geolocation" as PermissionName });
    if (!query) {
      stage("asking");
      request();
      return;
    }
    query.then(
      (status) => {
        if (settled) return;
        if (status.state === "denied") return fail("denied");
        permission = status;
        status.onchange = () => {
          if (status.state === "granted") stage("locating");
          else if (status.state === "denied") fail("denied");
        };
        stage(status.state === "granted" ? "locating" : "asking");
        request();
      },
      () => {
        stage("asking");
        request();
      },
    );
  });
}
