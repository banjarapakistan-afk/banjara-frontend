import type { Metadata } from "next";
import { ProviderApplication } from "@/components/auth/provider-application";

export const metadata: Metadata = { title: "Your provider application" };

export default async function ProviderApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; return?: string }>;
}) {
  // `?edit=details` comes from the review page's Edit link or a step's Back link. Read here,
  // on the server: during client-side navigation window.location may still show the previous URL.
  const { edit, return: returnTo } = await searchParams;
  // Only return to another application step (never an outside URL); guide tabs add `?step=`.
  const safeReturn =
    returnTo && /^\/provider-application\/[a-z-]+(\?step=[a-z]+)?$/.test(returnTo) ? returnTo : undefined;
  return <ProviderApplication editing={edit === "details"} returnTo={safeReturn} />;
}
