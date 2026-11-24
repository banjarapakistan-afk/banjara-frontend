"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Car,
  Check,
  Compass,
  LayoutDashboard,
  Map,
  MessageCircle,
  ShieldCheck,
  Store,
  UserRoundPlus,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { useQuery } from "@/lib/live-query";
import { getProviderCounts } from "@/services/customer/provider-application.service";
import { SectionHeading } from "./home-primitives";
import homeStyles from "./home.module.css";
import styles from "./provider-invite.module.css";

const SERVICES = [
  { icon: Car, label: "Rides", hint: "Vans & cars" },
  { icon: BedDouble, label: "Stays", hint: "Hotels & homes" },
  { icon: Map, label: "Tours", hint: "Trips & packages" },
  { icon: Compass, label: "Guides", hint: "Local experts" },
  { icon: UtensilsCrossed, label: "Food", hint: "Cafés & dining" },
] as const;

const STEPS = [
  { icon: UserRoundPlus, title: "Create your account", body: "Takes about 2 minutes. No payment needed." },
  { icon: Store, title: "Add your service", body: "Photos, prices and when you're available." },
  { icon: ShieldCheck, title: "Get verified & booked", body: "Our team checks you, then travellers can book." },
];

const PERKS = [
  "Travellers find you in search and on the map",
  "All your bookings in one dashboard",
  "See your earnings for every booking",
  "Chat with travellers in BANJARA messages",
];

const PROVIDER_LINKS = [
  { href: "/provider", icon: LayoutDashboard, label: "Dashboard", hint: "Your service at a glance" },
  { href: "/provider/bookings", icon: CalendarCheck, label: "Bookings", hint: "Confirm and check in" },
  { href: "/provider/earnings", icon: Wallet, label: "Earnings", hint: "Paid and still due" },
  { href: "/provider/messages", icon: MessageCircle, label: "Messages", hint: "Chat with travellers" },
];

/**
 * Home page invitation to become a service provider, in the same style as the rest of the
 * home page (section heading, white bordered cards, teal accents). Visitors are invited to
 * sign up, a signed-in traveller is told provider accounts are separate, and a provider gets
 * quick links to their own area instead of the pitch.
 */
export function HomeProviderInvite() {
  const { user, isAuthenticated, loading } = useCustomerAuth();
  const isProvider = isAuthenticated && user?.role === "provider";

  if (loading) return null;
  if (isProvider) return <ProviderShortcuts firstName={user?.name?.split(" ")[0] ?? ""} />;
  return <Invite signedInTraveller={isAuthenticated && user?.role === "customer"} />;
}

function Invite({ signedInTraveller }: { signedInTraveller: boolean }) {
  const router = useRouter();
  const { logout } = useCustomerAuth();
  const [switching, setSwitching] = useState(false);

  // Real numbers from the API; the section works without them.
  const counts = useQuery({
    queryKey: ["provider", "public-counts"],
    queryFn: getProviderCounts,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const joined = counts.data?.total.registered ?? 0;
  const live = counts.data?.total.approved ?? 0;

  const switchAccount = async () => {
    setSwitching(true);
    try {
      await logout();
      router.push("/register/provider");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <section className={homeStyles.section} aria-label="Become a BANJARA provider">
      <SectionHeading
        eyebrow="For local businesses"
        title="Earn with BANJARA"
        description="Run a ride, a stay, tours, a guide service or a restaurant in the north? List it and let travellers find and book you."
      />

      <div className={styles.panel}>
        <div className={styles.offer}>
          <p className={styles.label}>What you can offer</p>
          <ul className={styles.services}>
            {SERVICES.map((service) => (
              <li key={service.label}>
                {signedInTraveller ? (
                  // Signed-in travellers sign out first (button on the right), so these are not links.
                  <span className={styles.serviceTile}>
                    <ServiceTileBody service={service} />
                  </span>
                ) : (
                  <Link
                    href="/register/provider"
                    className={styles.serviceTile}
                    aria-label={`Offer ${service.label.toLowerCase()} on BANJARA`}
                  >
                    <ServiceTileBody service={service} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <ul className={styles.perks}>
            {PERKS.map((perk) => (
              <li key={perk}>
                <span className={styles.check} aria-hidden="true">
                  <Check size={13} strokeWidth={3} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.start}>
          <p className={styles.label}>How it works</p>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepIcon} aria-hidden="true">
                  <step.icon size={20} />
                </span>
                <div>
                  <span className={styles.stepNumber}>Step {index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.actions}>
            {signedInTraveller ? (
              <button
                type="button"
                className={`${homeStyles.primary} ${styles.cta}`}
                onClick={() => void switchAccount()}
                disabled={switching}
              >
                Sign out & become a provider
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <Link href="/register/provider" className={`${homeStyles.primary} ${styles.cta}`}>
                  Become a provider
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/login" className={styles.secondary}>
                  Already a provider? Log in
                </Link>
              </>
            )}
          </div>
          {signedInTraveller ? (
            <p className={styles.note}>
              Provider accounts are separate from traveller accounts, so use a different email for your business.
            </p>
          ) : joined > 0 ? (
            <p className={styles.note}>
              <strong>{joined.toLocaleString("en-PK")} providers</strong> have joined
              {live ? ` · ${live.toLocaleString("en-PK")} are live` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ServiceTileBody({ service }: { service: (typeof SERVICES)[number] }) {
  return (
    <>
      <span className={styles.icon} aria-hidden="true">
        <service.icon size={20} />
      </span>
      <strong>{service.label}</strong>
      <small>{service.hint}</small>
    </>
  );
}

/** A signed-in provider doesn't need the pitch: just quick ways back to their area. */
function ProviderShortcuts({ firstName }: { firstName: string }) {
  return (
    <section className={homeStyles.section} aria-label="Your business">
      <SectionHeading
        eyebrow="Your business"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Jump straight to what you need for your service."
        href="/provider"
        action="Open dashboard"
      />
      <ul className={styles.shortcuts}>
        {PROVIDER_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.shortcut}>
              <span className={styles.icon} aria-hidden="true">
                <link.icon size={20} />
              </span>
              <span className={styles.shortcutText}>
                <strong>{link.label}</strong>
                <small>{link.hint}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" className={styles.shortcutArrow} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
