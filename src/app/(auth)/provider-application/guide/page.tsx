import type { Metadata } from "next";
import { GuideApplication } from "@/components/auth/guide-application";
import type { GuideStep } from "@/lib/driver-steps";

export const metadata: Metadata = { title: "Your guide profile" };

const STEPS: GuideStep[] = ["profile", "services", "schedule", "photos", "review"];

export default async function GuideApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  // Read on the server: during client-side navigation window.location may lag behind.
  const { step } = await searchParams;
  const requested = STEPS.includes(step as GuideStep) ? (step as GuideStep) : undefined;
  return <GuideApplication requested={requested} />;
}
