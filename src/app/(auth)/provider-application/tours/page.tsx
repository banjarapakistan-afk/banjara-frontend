import type { Metadata } from "next";
import { TourApplication } from "@/components/auth/tour-application";
import type { TourStep } from "@/lib/driver-steps";

export const metadata: Metadata = { title: "Your tour company" };

const STEPS: TourStep[] = ["company", "tour", "review"];

export default async function TourApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  // Read on the server: during client-side navigation window.location may lag behind.
  const { step } = await searchParams;
  const requested = STEPS.includes(step as TourStep) ? (step as TourStep) : undefined;
  return <TourApplication requested={requested} />;
}
