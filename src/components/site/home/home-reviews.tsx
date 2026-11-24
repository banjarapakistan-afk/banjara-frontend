"use client";
/* eslint-disable @next/next/no-img-element */
import { BadgeCheck, Quote, Star } from "lucide-react";
import { useQuery } from "@/lib/live-query";
import { getReviewHighlights, type ReviewHighlight } from "@/services/customer/review.service";
import { SectionHeading } from "./home-primitives";
import styles from "./home.module.css";

const SERVICE_LABEL: Record<ReviewHighlight["serviceType"], string> = {
  transport: "Ride",
  hotel: "Stay",
  tour: "Tour",
  guide: "Guide",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function monthYear(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "Asia/Karachi" });
}

/**
 * "What travellers say": real reviews from completed bookings. Renders nothing until
 * customers have written some — never placeholder testimonials.
 */
export function HomeReviews() {
  const query = useQuery({
    queryKey: ["customer", "home-review-highlights"],
    queryFn: () => getReviewHighlights(6),
    staleTime: 5 * 60 * 1000,
  });
  const data = query.data;
  if (!data?.items.length) return null;
  const reviews = data.items.slice(0, 3);

  return (
    <section className={styles.section} aria-label="Customer reviews">
      <SectionHeading
        eyebrow="REAL TRAVELLERS"
        title="What travellers say"
        description="Reviews from customers who booked and travelled with BANJARA."
      />
      {data.average && data.total > 0 ? (
        <p className={styles.reviewSummary}>
          <Star size={16} fill="currentColor" aria-hidden="true" />
          <strong>{data.average.toFixed(1)}</strong>
          average from {data.total.toLocaleString("en-PK")}{" "}
          {data.total === 1 ? "review" : "reviews"}
          <span>
            <BadgeCheck size={14} aria-hidden="true" />
            Every review is from a real booking
          </span>
        </p>
      ) : null}
      <ul className={styles.reviewGrid}>
        {reviews.map((review) => (
          <li key={review.id} className={styles.reviewCard}>
            <Quote size={22} className={styles.reviewQuote} aria-hidden="true" />
            <span
              className={styles.reviewStars}
              role="img"
              aria-label={`Rated ${review.rating} out of 5`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={15}
                  fill={i < Math.round(review.rating) ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              ))}
            </span>
            <blockquote>{review.comment}</blockquote>
            <footer>
              {review.reviewerAvatar ? (
                <img src={review.reviewerAvatar} alt="" className={styles.reviewAvatar} />
              ) : (
                <span className={styles.reviewAvatar} aria-hidden="true">
                  {initials(review.reviewerName)}
                </span>
              )}
              <span>
                <strong>{review.reviewerName}</strong>
                <small>
                  {[SERVICE_LABEL[review.serviceType], review.tripLabel || review.place]
                    .filter(Boolean)
                    .join(" · ")}
                  {monthYear(review.createdAt) ? ` · ${monthYear(review.createdAt)}` : ""}
                </small>
              </span>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
