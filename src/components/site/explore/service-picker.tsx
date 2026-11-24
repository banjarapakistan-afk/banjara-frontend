"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CarFront,
  Check,
  Hotel,
  Info,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MapPinOff,
  MountainSnow,
  Navigation,
  Search,
  ShieldCheck,
  Signpost,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  NEAR_DEFAULT_KM,
  locateVisitor,
  nearMeHref,
  type LocateFailure,
  type LocateStage,
} from "@/lib/near-me";
import type { ExploreService } from "@/lib/explore-catalog";
import { getDiscover } from "@/services/customer/discover.service";
import styles from "./service-picker.module.css";

const OTHERS: { id: Exclude<ExploreService, "transport">; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: "hotels", label: "Stay", hint: "Hotels & guest houses", icon: <Hotel size={22} aria-hidden="true" /> },
  { id: "tours", label: "Tours", hint: "Treks & expeditions", icon: <MountainSnow size={22} aria-hidden="true" /> },
  { id: "guides", label: "Guides", hint: "Local experts", icon: <Signpost size={22} aria-hidden="true" /> },
  { id: "restaurants", label: "Restaurants", hint: "Food & offers", icon: <UtensilsCrossed size={22} aria-hidden="true" /> },
];

type Step = "choose" | "locating" | "destination" | LocateFailure;

/** Where rides picking up near the visitor are going, busiest first. */
type Destination = { name: string; rides: number; from: number | null };

const ENABLE_STEPS = [
  "Click the location or lock icon at the left of the address bar.",
  "Set Location to Allow for this site.",
  "Come back here and press Try again.",
];
const DEVICE_STEPS = [
  "Turn on location services on your device (Windows: Settings › Privacy & security › Location).",
  "Make sure your browser is allowed to use location.",
  "Press Try again.",
];

/** What to tell the visitor for each way locating can fail. */
const FAILURE: Record<LocateFailure, { title: string; body: string; steps?: string[]; retry?: string }> = {
  denied: {
    title: "Enable your location",
    body: "Location is blocked for this site, so we can’t find rides near you. Turn it on in three quick steps:",
    steps: ENABLE_STEPS,
    retry: "Try again",
  },
  noanswer: {
    title: "We didn’t get your location",
    body: "Your browser’s location request wasn’t answered. Allow location to find rides near you:",
    steps: ENABLE_STEPS,
    retry: "Ask again",
  },
  insecure: {
    title: "Location needs a secure connection",
    body: "Browsers only share location on secure (https) pages. Open BANJARA over https to find rides near you, or browse every ride now.",
  },
  timeout: {
    title: "Finding your location took too long",
    body: "Your device didn’t return a position in time. Check that location is on, then try again:",
    steps: DEVICE_STEPS,
    retry: "Try again",
  },
  unavailable: {
    title: "We couldn’t find your location",
    body: "Your device couldn’t work out where you are. Check that location is on, then try again:",
    steps: DEVICE_STEPS,
    retry: "Try again",
  },
};

/**
 * "What are you looking for?" — shown when a visitor opens Explore. Choosing Ride asks for
 * their location and opens the map with rides near them; other services open that tab.
 */
/** Minimum time on "Pinpointing your position" before showing "Found you". */
const MIN_LOCATING_MS = 2600;
/** How long "Found you! Opening the map…" stays before navigating. */
const FOUND_HOLD_MS = 900;

export function ServicePicker({
  startWith = "choose",
  onPick,
  onClose,
}: {
  /** "locating" skips the question (the "Rides near me" button). */
  startWith?: "choose" | "locating";
  onPick: (service: ExploreService) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>(startWith);
  const alive = useRef(true);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // Start on the main choice (Ride), not the close button the browser would pick.
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    alive.current = true;
    return () => {
      alive.current = false;
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);

  // Progress while locating: waiting for permission → getting a fix → found, opening the map.
  const [stage, setStage] = useState<LocateStage | "found">("asking");
  // After a few seconds with the prompt unanswered, point at where the browser shows it.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (step !== "locating" || stage !== "asking") return;
    const id = setTimeout(() => setNudge(true), 6000);
    return () => clearTimeout(id);
  }, [step, stage]);

  // After locating: the visitor's position and where nearby rides are heading.
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [destinationsFailed, setDestinationsFailed] = useState(false);
  const [typed, setTyped] = useState("");

  const loadDestinations = useCallback((lat: number, lng: number) => {
    setDestinations(null);
    setDestinationsFailed(false);
    getDiscover({ service: "transport", near: `${lat},${lng}`, radius: NEAR_DEFAULT_KM }).then(
      (result) => {
        if (!alive.current) return;
        const byName = new Map<string, Destination>();
        for (const card of result.items) {
          const name = (card.route?.to.name || card.city || "").trim();
          if (!name) continue;
          const key = name.toLowerCase();
          const current = byName.get(key) ?? { name, rides: 0, from: null };
          current.rides += 1;
          if (card.price && card.price > 0 && (current.from === null || card.price < current.from)) {
            current.from = card.price;
          }
          byName.set(key, current);
        }
        setDestinations(
          [...byName.values()].sort((a, b) => b.rides - a.rides || a.name.localeCompare(b.name)),
        );
      },
      () => {
        if (alive.current) setDestinationsFailed(true);
      },
    );
  }, []);

  /** Open the map with rides near the visitor, only those going to `to` when given. */
  const openRides = (to?: string) => {
    if (!position) return;
    const href = nearMeHref(position.lat, position.lng);
    router.push(to ? `${href}&${new URLSearchParams({ to })}` : href);
  };

  const findRides = useCallback(() => {
    setStep("locating");
    setStage("asking");
    setNudge(false);
    const startedAt = Date.now();
    locateVisitor((next) => {
      if (alive.current) setStage(next);
    }).then(
      ({ lat, lng }) => {
        if (!alive.current) return;
        setPosition({ lat, lng });
        // Look up nearby destinations while the progress steps play out.
        loadDestinations(lat, lng);
        // Pace the steps so the whole flow takes ~3.5s even when the fix is instant:
        // "Pinpointing" stays up until MIN_LOCATING_MS, then "Found you" shows briefly.
        const wait = Math.max(0, MIN_LOCATING_MS - (Date.now() - startedAt));
        setTimeout(() => {
          if (!alive.current) return;
          setStage("found");
          setTimeout(() => {
            if (!alive.current) return;
            setTyped("");
            setStep("destination");
          }, FOUND_HOLD_MS);
        }, wait);
      },
      (failure: LocateFailure) => {
        if (alive.current) setStep(failure);
      },
    );
  }, [loadDestinations]);

  // Opened from "Rides near me": go straight to locating.
  const started = useRef(false);
  useEffect(() => {
    if (startWith !== "locating" || started.current) return;
    started.current = true;
    const id = requestAnimationFrame(findRides);
    return () => cancelAnimationFrame(id);
  }, [startWith, findRides]);

  const failed = step !== "choose" && step !== "locating" && step !== "destination";
  const failure = failed ? FAILURE[step] : null;
  const query = typed.trim().toLowerCase();
  const shownDestinations = (destinations ?? []).filter(
    (place) => !query || place.name.toLowerCase().includes(query),
  );
  const progress: { label: string; state: "done" | "active" | "waiting" }[] = [
    {
      label: stage === "asking" ? "Waiting for location permission" : "Location permission allowed",
      state: stage === "asking" ? "active" : "done",
    },
    {
      label: stage === "found" ? "Found your position" : "Pinpointing your position",
      state: stage === "locating" ? "active" : stage === "found" ? "done" : "waiting",
    },
    {
      label: `Finding rides within ${NEAR_DEFAULT_KM} km`,
      state: stage === "found" ? "active" : "waiting",
    },
  ];

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="service-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>

      {step === "choose" && (
        <>
          <p className={styles.eyebrow}>Welcome to Explore</p>
          <h2 id="service-picker-title" className={styles.title}>
            What are you looking for?
          </h2>
          <p className={styles.lead}>Pick a service and we’ll take you straight there.</p>

          <button type="button" className={styles.ride} onClick={findRides} data-autofocus>
            <span className={styles.rideIcon}>
              <CarFront size={26} aria-hidden="true" />
            </span>
            <span className={styles.rideText}>
              <strong>Ride</strong>
              <small>Find rides with pickups near you</small>
              <em>
                <LocateFixed size={13} aria-hidden="true" />
                Uses your location · within 10 km
              </em>
            </span>
            <ArrowRight size={20} className={styles.rideArrow} aria-hidden="true" />
          </button>

          <div className={styles.grid}>
            {OTHERS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={styles.option}
                onClick={() => onPick(option.id)}
              >
                <span className={styles.optionIcon}>{option.icon}</span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>

          <button type="button" className={styles.skip} onClick={onClose}>
            Just browse everything
          </button>
        </>
      )}

      {step === "locating" && (
        <div className={styles.state}>
          <div className={styles.radar} data-stage={stage} aria-hidden="true">
            <span className={styles.ring} />
            <span className={styles.ring} />
            <span className={styles.ring} />
            <span className={styles.sweep} />
            <span className={styles.radarPin}>
              {stage === "found" ? <Check size={28} strokeWidth={3} /> : <MapPin size={28} />}
            </span>
          </div>
          <h2 id="service-picker-title" className={styles.title} aria-live="polite">
            {stage === "asking"
              ? "Allow location access"
              : stage === "locating"
                ? "Finding your location…"
                : "Found you!"}
          </h2>
          <p className={styles.lead}>
            {stage === "asking"
              ? "Your browser will ask to share your location. Choose Allow so we can show rides you can reach."
              : stage === "locating"
                ? "Getting your position. This usually takes a few seconds."
                : `Looking for rides with pickups within ${NEAR_DEFAULT_KM} km of you.`}
          </p>

          <ol className={styles.progress} aria-label="Progress">
            {progress.map((item) => (
              <li key={item.label} data-state={item.state}>
                <span className={styles.progressDot} aria-hidden="true">
                  {item.state === "done" ? (
                    <Check size={13} strokeWidth={3} />
                  ) : item.state === "active" ? (
                    <LoaderCircle size={14} className={styles.spin} />
                  ) : null}
                </span>
                {item.label}
              </li>
            ))}
          </ol>

          {nudge && stage === "asking" && (
            <p className={styles.nudge} role="status">
              <Info size={16} aria-hidden="true" />
              <span>
                Don’t see a prompt? Click the location or lock icon at the left of the address bar and set{" "}
                <strong>Location</strong> to <strong>Allow</strong>.
              </span>
            </p>
          )}
          <p className={styles.privacy}>
            <ShieldCheck size={14} aria-hidden="true" />
            Used only for this search. We don’t store your location.
          </p>
          <button type="button" className={styles.skip} onClick={() => onPick("transport")}>
            Skip and browse all rides
          </button>
        </div>
      )}

      {step === "destination" && (
        <div className={styles.where}>
          <p className={styles.eyebrow}>
            <LocateFixed size={13} aria-hidden="true" /> Pickups within {NEAR_DEFAULT_KM} km of you
          </p>
          <h2 id="service-picker-title" className={styles.title}>
            Where do you want to go?
          </h2>
          <p className={styles.lead}>Pick a destination and we’ll show rides heading there.</p>

          <form
            className={styles.whereSearch}
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const exact = shownDestinations.find((place) => place.name.toLowerCase() === query);
              if (exact) openRides(exact.name);
              else if (shownDestinations.length === 1) openRides(shownDestinations[0].name);
              else if (typed.trim()) openRides(typed.trim());
            }}
          >
            <Search size={17} aria-hidden="true" />
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Search a city, e.g. Skardu"
              aria-label="Destination"
              maxLength={100}
              data-autofocus
              autoFocus
            />
          </form>

          {destinations === null && !destinationsFailed ? (
            <p className={styles.whereNote} role="status">
              <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
              Finding where nearby rides go…
            </p>
          ) : destinationsFailed ? (
            <p className={styles.whereNote} role="alert">
              We couldn’t load destinations. Type one above, or see every ride near you.
            </p>
          ) : destinations && destinations.length === 0 ? (
            <p className={styles.whereNote}>
              No rides pick up within {NEAR_DEFAULT_KM} km of you right now. You can browse every ride instead.
            </p>
          ) : shownDestinations.length === 0 ? (
            <p className={styles.whereNote}>
              No nearby rides go to “{typed.trim()}”. Press Enter to search anyway.
            </p>
          ) : (
            <ul className={styles.places} aria-label="Destinations">
              {shownDestinations.map((place) => (
                <li key={place.name}>
                  <button type="button" className={styles.place} onClick={() => openRides(place.name)}>
                    <span className={styles.placeIcon}>
                      <Navigation size={16} aria-hidden="true" />
                    </span>
                    <span className={styles.placeText}>
                      <strong>{place.name}</strong>
                      <small>
                        {place.rides} {place.rides === 1 ? "ride" : "rides"}
                        {place.from !== null ? ` · from Rs ${place.from.toLocaleString("en-PK")}` : ""}
                      </small>
                    </span>
                    <ArrowRight size={18} className={styles.placeArrow} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.actions}>
            {destinations && destinations.length === 0 ? (
              <button type="button" className={styles.primary} onClick={() => onPick("transport")}>
                Browse all rides
              </button>
            ) : (
              <button type="button" className={styles.secondary} onClick={() => openRides()}>
                <MapPin size={16} aria-hidden="true" />
                Show all rides near me
              </button>
            )}
          </div>
        </div>
      )}

      {failure && (
        <div className={styles.state} role="alert">
          <span className={`${styles.stateIcon} ${styles.warn}`}>
            <MapPinOff size={28} aria-hidden="true" />
          </span>
          <h2 id="service-picker-title" className={styles.title}>
            {failure.title}
          </h2>
          <p className={styles.lead}>{failure.body}</p>
          {failure.steps && (
            <ol className={styles.howTo}>
              {failure.steps.map((text, i) => (
                <li key={text}>
                  <span aria-hidden="true">{i + 1}</span>
                  {text}
                </li>
              ))}
            </ol>
          )}
          <div className={styles.actions}>
            {failure.retry && (
              <button type="button" className={styles.primary} onClick={findRides}>
                <LocateFixed size={17} aria-hidden="true" />
                {failure.retry}
              </button>
            )}
            <button type="button" className={styles.secondary} onClick={() => onPick("transport")}>
              Browse all rides instead
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
