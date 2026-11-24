import { WebsiteExplore } from "@/components/site/explore/website-explore";
import { getRecommendedTrips } from "@/services/customer/trip.service";
import { getPopularHotels } from "@/services/customer/hotel.service";
import { getDiscoveryListings } from "@/services/customer/discovery.service";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Explore northern valleys",
  description:
    "Explore Hunza, Skardu, Fairy Meadows, Swat and the Karakoram with local transport, stays, guides and tours.",
};
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Rides are browsed on the map, never as a list here: send any ride link
  // (header, footer, trip pages, Home ride search…) straight to /explore/map.
  const query = await searchParams;
  if (query.service === "transport") {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) {
        next.append(key, item);
      }
    }
    redirect(`/explore/map?${next}`);
  }
  const [trips, hotels, guides, tours] = await Promise.allSettled([
    getRecommendedTrips(100),
    getPopularHotels(100),
    getDiscoveryListings("guides"),
    getDiscoveryListings("tours"),
  ]);
  return (
    <WebsiteExplore
      initialTrips={trips.status === "fulfilled" ? trips.value : undefined}
      initialHotels={hotels.status === "fulfilled" ? hotels.value : undefined}
      initialGuides={guides.status === "fulfilled" ? guides.value : undefined}
      initialTours={tours.status === "fulfilled" ? tours.value : undefined}
    />
  );
}
