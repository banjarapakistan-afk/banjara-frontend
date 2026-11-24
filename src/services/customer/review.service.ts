import { customerGet } from "@/lib/customer-api";
import { normalizeMediaUrl } from "@/lib/customer-mappers";

/** One real review from a completed Banjara booking, as shown on Home. */
export type ReviewHighlight = {
  id: string;
  rating: number;
  comment: string;
  serviceType: "transport" | "hotel" | "tour" | "guide";
  /** "Ayesha K." — first name and last initial only. */
  reviewerName: string;
  reviewerAvatar: string | null;
  providerName: string | null;
  providerId: string;
  /** What was booked: "Islamabad → Hunza", a hotel name or a tour title. */
  tripLabel: string | null;
  place: string | null;
  createdAt: string;
};

export type ReviewHighlights = {
  average: number | null;
  total: number;
  items: ReviewHighlight[];
};

/** Overall rating plus recent written 4★/5★ reviews (empty until customers leave some). */
export async function getReviewHighlights(limit = 6): Promise<ReviewHighlights> {
  const data = await customerGet<ReviewHighlights>("/reviews/highlights", {
    params: { limit },
  });
  return {
    average: data?.average ?? null,
    total: data?.total ?? 0,
    items: (data?.items ?? []).map((item) => ({
      ...item,
      reviewerAvatar: normalizeMediaUrl(item.reviewerAvatar) ?? null,
    })),
  };
}
