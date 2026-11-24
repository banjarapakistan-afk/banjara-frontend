"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { homeAfterAuth } from "@/lib/auth-redirect";

/**
 * The traveller's own pages (profile, bookings, messages). Provider accounts are separate
 * and are sent to their own area instead; the API refuses them traveller data anyway.
 */
export function TravellerOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCustomerAuth();
  const otherRole = !loading && !!user && user.role !== "customer";

  useEffect(() => {
    if (otherRole && user) router.replace(homeAfterAuth(user));
  }, [otherRole, user, router]);

  return otherRole ? null : <>{children}</>;
}
