"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Car,
  ChevronRight,
  CircleCheck,
  LoaderCircle,
  Navigation,
  Route,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "@/lib/live-query";
import { directionsUrl } from "@/lib/map-config";
import { kmText, minutesText, type PickupDistance } from "@/lib/pickup-distance";
import { getTripById } from "@/services/customer/trip.service";
import type { DiscoverCard } from "@/types/customer/discover";
import styles from "./ride-sheet.module.css";

/** The ride's own trip by road, pickup → destination. */
export type TripLeg = {
  /** The road route is still being looked up. */
  loading: boolean;
  distanceKm: number | null;
  durationMin: number | null;
  from: string;
  to: string;
};

/** Trips in these states can't be booked any more. */
const CLOSED = new Set(["cancelled", "completed", "departed", "intransit", "in_transit"]);

/** Drag the handle down this far (px) to dismiss on touch screens. */
const DISMISS_DRAG = 80;

/**
 * Card for the ride picked on the map: photo, vehicle + operator (logo inline), a short facts list
 * (date, seats, features), a pickup → drop-off route, then price and Book on one row.
 * Desktop: docked on the right of the map. Phones: a bottom sheet (drag down to close).
 */
export function RideSheet({
  ride,
  distance,
  leg = null,
  departure,
  detailsHref,
  top,
  onClose,
}: {
  ride: DiscoverCard & { location: NonNullable<DiscoverCard["location"]> };
  /** Shown in the card on phones; desktop shows it in the journey bar under the map. */
  distance: PickupDistance | null;
  /** The trip by road (distance and drive time), drawn on the map too. */
  leg?: TripLeg | null;
  /** "Sat 14 Nov · 7:00 AM" */
  departure: string | null;
  detailsHref: string;
  /** Desktop: px from the top of the map where the card docks (below the toolbar). */
  top: number;
  onClose: () => void;
}) {
  const tripId = ride.target.id;
  // Live seats, status, rating and verification; the card works before this arrives.
  const full = useQuery({
    queryKey: ["ride-sheet-trip", tripId],
    queryFn: () => getTripById(tripId),
    staleTime: 30 * 1000,
    retry: 1,
  });
  const trip = full.data ?? null;
  const loadingTrip = full.isPending;
  const failed = !loadingTrip && (full.isError || !trip);

  const wholeVehicle = ride.priceUnit?.includes("vehicle") ?? false;
  const soldOut = !!trip && trip.availableSeats <= 0;
  const closed = !!trip && CLOSED.has(String(trip.status ?? "").trim().toLowerCase());
  const canBook = !!trip && !soldOut && !closed;
  const operator = ride.subtitle || trip?.agency.name || "Transport provider";
  const logo = ride.providerLogo || trip?.agency.logo || null;
  const rating = (trip ? trip.agency.rating || trip.rating : ride.rating) || 0;
  const reviews = trip?.agency.reviewCount || ride.reviewCount || 0;
  const verified = ride.verified || !!trip?.agency.verified;
  const [from, to] = (ride.tags[0] ?? "").split("→").map((part) => part.trim());
  const extras = ride.tags.slice(1, 3);
  const price = ride.price && ride.price > 0 ? `Rs ${ride.price.toLocaleString("en-PK")}` : null;

  const seats = wholeVehicle
    ? trip
      ? `Whole vehicle · up to ${trip.totalSeats || trip.availableSeats} seats`
      : "Whole vehicle"
    : loadingTrip
      ? "Checking seats…"
      : trip
        ? soldOut
          ? "Sold out"
          : `${trip.availableSeats} ${trip.availableSeats === 1 ? "seat" : "seats"} left`
        : "Seats on request";
  const fewSeats = !wholeVehicle && !!trip && trip.availableSeats > 0 && trip.availableSeats <= 3;
  const seatTone = soldOut || fewSeats ? styles.warn : trip && !wholeVehicle ? styles.good : "";

  // Touch: drag the photo down to dismiss. (The slide-in is a CSS animation; the parent
  // remounts the card per ride, so it replays when another ride is picked.)
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const setDrag = (dy: number) => {
    sheet.current?.style.setProperty("--drag", `${dy}px`);
  };

  return (
    <section
      ref={sheet}
      className={styles.sheet}
      style={{ "--sheet-top": `${top}px` } as CSSProperties}
      aria-label={`${ride.title}, ${operator}`}
    >
      {/* Photo (also the drag area on phones). */}
      <div
        className={styles.hero}
        onTouchStart={(event) => {
          drag.current = { y: event.touches[0].clientY, dy: 0 };
        }}
        onTouchMove={(event) => {
          if (!drag.current) return;
          drag.current.dy = Math.max(0, event.touches[0].clientY - drag.current.y);
          setDrag(drag.current.dy);
        }}
        onTouchEnd={() => {
          const dy = drag.current?.dy ?? 0;
          drag.current = null;
          setDrag(0);
          if (dy > DISMISS_DRAG) onClose();
        }}
      >
        {ride.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.photo} src={ride.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.photoEmpty}>
            <Car size={34} aria-hidden="true" />
          </span>
        )}
        <span className={styles.handle} aria-hidden="true" />
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close ride details">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.body}>
        {/* Vehicle + operator */}
        <div className={styles.head}>
          <span className={styles.logo}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" referrerPolicy="no-referrer" />
            ) : (
              <Car size={20} aria-hidden="true" />
            )}
          </span>
          <div className={styles.headText}>
            <h2 className={styles.title}>{ride.title}</h2>
            <p className={styles.operator}>
              <span className={styles.operatorName}>{operator}</span>
              {verified && <BadgeCheck size={14} aria-label="Verified provider" className={styles.verified} />}
              <span className={styles.dot} aria-hidden="true">·</span>
              {rating ? (
                <span className={styles.rating}>
                  <Star size={12} fill="currentColor" aria-hidden="true" className={styles.star} />
                  {rating.toFixed(1)}
                  {reviews ? <span className={styles.reviews}>({reviews})</span> : null}
                </span>
              ) : (
                <span className={styles.newTag}>New</span>
              )}
            </p>
          </div>
        </div>

        {/* Facts */}
        <ul className={styles.facts}>
          {departure && (
            <li>
              <CalendarClock size={16} aria-hidden="true" />
              <span>{departure}</span>
            </li>
          )}
          <li className={seatTone}>
            {loadingTrip && !wholeVehicle ? (
              <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
            ) : (
              <Users size={16} aria-hidden="true" />
            )}
            <span>{seats}</span>
          </li>
          {extras.length > 0 && (
            <li>
              <Sparkles size={16} aria-hidden="true" />
              <span>{extras.join(" · ")}</span>
            </li>
          )}
          {distance && (
            // Laptops and phones only (wide desktops show the journey bar under the map).
            <li className={`${styles.factDistance} ${styles.info}`} aria-live="polite">
              {distance.loading ? (
                <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
              ) : distance.atPickup ? (
                <CircleCheck size={16} aria-hidden="true" />
              ) : (
                <Car size={16} aria-hidden="true" />
              )}
              <span>{distance.headline.replace(" by road · about ", " · ")}</span>
            </li>
          )}
        </ul>

        {/* Pickup → drop-off */}
        <ol className={styles.timeline}>
          <li>
            <span className={`${styles.stop} ${styles.stopFrom}`} aria-hidden="true" />
            <div>
              <strong>{from || "Pickup"}</strong>
              <small>{ride.location.address}</small>
            </div>
          </li>
          {leg && (leg.loading || leg.distanceKm !== null) && (
            <li className={styles.leg} aria-live="polite">
              <span className={styles.legGap} aria-hidden="true" />
              <span className={styles.legText}>
                {leg.loading ? (
                  <LoaderCircle size={13} className={styles.spin} aria-hidden="true" />
                ) : (
                  <Route size={13} aria-hidden="true" />
                )}
                {leg.loading
                  ? "Measuring the road…"
                  : `${kmText(leg.distanceKm!)} · about ${minutesText(leg.durationMin ?? 0)} drive`}
              </span>
            </li>
          )}
          <li>
            <span className={`${styles.stop} ${styles.stopTo}`} aria-hidden="true" />
            <div>
              <strong>{to || ride.city || "Destination"}</strong>
              <small>Drop-off</small>
            </div>
          </li>
        </ol>

        <div className={styles.links}>
          <Link href={detailsHref} className={styles.link}>
            Trip details
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
          {!ride.location.approximate && (
            <a
              className={styles.link}
              href={directionsUrl(ride.location.lat, ride.location.lng)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={14} aria-hidden="true" />
              Directions to pickup
            </a>
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.price}>
          <strong>{price ?? "Ask for price"}</strong>
          {price && <small>{wholeVehicle ? "per vehicle" : "per seat"}</small>}
        </p>
        {canBook ? (
          <Link className={styles.book} href={`/trips/${encodeURIComponent(tripId)}/book?passengers=1`}>
            {wholeVehicle ? "Book vehicle" : "Book a seat"}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : failed ? (
          <Link className={styles.book} href={detailsHref}>
            View &amp; book
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${styles.book} ${styles.bookOff}`} aria-disabled="true" role="button">
            {loadingTrip && <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />}
            {loadingTrip ? "Checking…" : soldOut ? "Sold out" : "Not available"}
          </span>
        )}
      </footer>
    </section>
  );
}
