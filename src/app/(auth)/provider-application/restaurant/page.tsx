import type { Metadata } from "next";
import { RestaurantApplication } from "@/components/auth/restaurant-application";
import type { RestaurantStep } from "@/lib/driver-steps";

export const metadata: Metadata = { title: "Your restaurant" };

const STEPS: RestaurantStep[] = ["profile", "menu", "review"];

export default async function RestaurantApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  // Read on the server: during client-side navigation window.location may lag behind.
  const { step } = await searchParams;
  const requested = STEPS.includes(step as RestaurantStep) ? (step as RestaurantStep) : undefined;
  return <RestaurantApplication requested={requested} />;
}
