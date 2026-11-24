import { TravellerOnly } from "@/components/site/traveller-only";

/** Traveller-only pages: provider accounts are sent to the provider area. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <TravellerOnly>{children}</TravellerOnly>;
}
