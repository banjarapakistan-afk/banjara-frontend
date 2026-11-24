"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  LoaderCircle,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Send,
  Tag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { useBackendStatus, useQuery } from "@/lib/live-query";
import { RESTAURANT_STEP_TOTAL, previousStep, type RestaurantStep } from "@/lib/driver-steps";
import { getProviderApplication } from "@/services/customer/auth.service";
import {
  HOUR_DAYS,
  formatHours,
  getMyRestaurantApplication,
  menuMissing,
  newOfferId,
  parseHours,
  restaurantMissing,
  saveRestaurant,
  type MyRestaurantApplication,
  type OfferType,
  type RestaurantOffer,
  type RestaurantProfile,
} from "@/services/customer/restaurant-application.service";
import { AuthShell } from "./auth-shell";
import { AuthBanner, AuthField } from "./auth-fields";
import { Gallery, Head, SaveButton, TagInput, TextArea } from "./form-bits";
import styles from "./auth.module.css";
import v from "./vehicle.module.css";
import g from "./guide.module.css";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

const ORDER: RestaurantStep[] = ["profile", "menu", "review"];
const STEP_NO: Record<RestaurantStep, number> = { profile: 5, menu: 6, review: 7 };
const TITLES: Record<RestaurantStep, string> = {
  profile: "Your restaurant",
  menu: "Menu & offers",
  review: "Review & submit",
};
const SUBTITLES: Record<RestaurantStep, string> = {
  profile: "Travellers choose where to eat from photos and a few words. Show them your food and your place.",
  menu: "List the dishes people come for, and any deals. You can change these any time from your dashboard.",
  review: "Check everything before sending it to BANJARA. Our team usually reviews restaurants within 1–2 working days.",
};

const CUISINES = ["Pakistani", "Desi BBQ", "Hunza local", "Balti", "Chinese", "Continental", "Fast food", "Café & bakery", "Tea & coffee", "Vegetarian", "Seafood", "Italian"];
/** One-tap dish ideas for each cuisine the restaurant serves. */
const DISHES: Record<string, string[]> = {
  Pakistani: ["Chicken karahi", "Daal chawal", "Biryani", "Nihari", "Haleem"],
  "Desi BBQ": ["Chicken tikka", "Seekh kebab", "Malai boti", "Mutton chops"],
  "Hunza local": ["Chapshoro", "Diram fitti", "Hunza soup", "Apricot cake", "Walnut cake"],
  Balti: ["Balti chicken", "Mamtu", "Prapu", "Butter tea"],
  Chinese: ["Chicken chow mein", "Egg fried rice", "Manchurian", "Hot & sour soup"],
  Continental: ["Grilled chicken", "Steak", "Pasta", "Club sandwich"],
  "Fast food": ["Burger", "Zinger burger", "Fries", "Shawarma", "Pizza"],
  "Café & bakery": ["Cakes", "Pastries", "Cookies", "Sandwiches"],
  "Tea & coffee": ["Doodh patti chai", "Green tea", "Cappuccino", "Hot chocolate"],
  Vegetarian: ["Mix vegetable", "Palak paneer", "Daal mash", "Salad bar"],
  Seafood: ["Fried fish", "Trout", "Prawns"],
  Italian: ["Pizza", "Pasta", "Lasagna"],
};
const OFFER_TYPES: Array<{ value: OfferType; label: string; sub: string; icon: typeof Percent }> = [
  { value: "discount", label: "% off", sub: "e.g. 20% off lunch", icon: Percent },
  { value: "offer", label: "Deal", sub: "e.g. Free tea with any karahi", icon: Tag },
  { value: "sale", label: "Sale price", sub: "e.g. Family platter Rs 2,500", icon: Tag },
];
const OFFER_IDEAS = ["Family deal", "Lunch special", "Free tea with any meal", "Student discount", "Group discount"];

const hrefFor = (step: RestaurantStep) => `/provider-application/restaurant?step=${step}`;
const caption = (step: RestaurantStep) => `Restaurant · Step ${STEP_NO[step]} of ${RESTAURANT_STEP_TOTAL}`;

function firstOpenStep(app: MyRestaurantApplication): RestaurantStep {
  if (restaurantMissing(app.restaurant).length) return "profile";
  if (menuMissing(app.restaurant).length) return "menu";
  return "review";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Steps 5–7 for restaurants on the website (after "Your details" and the map pin). */
export function RestaurantApplication({ requested }: { requested?: RestaurantStep }) {
  const router = useRouter();
  const { user, loading } = useCustomerAuth();
  const isProvider = user?.role === "provider";
  const backend = useBackendStatus();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!isProvider) router.replace("/account");
  }, [loading, user, isProvider, router]);

  const application = useQuery({
    queryKey: ["provider", "application", user?.id],
    queryFn: getProviderApplication,
    enabled: isProvider,
  });
  const isRestaurant = Boolean(application.data?.services.includes("restaurant"));
  const needsPin = isRestaurant && !application.data?.location;
  useEffect(() => {
    if (!application.isSuccess) return;
    if (!application.data) router.replace("/provider-application");
    else if (!isRestaurant) router.replace("/provider");
    // The map pin comes first: travellers need to find the restaurant.
    else if (needsPin) router.replace("/provider-application/location");
  }, [application.isSuccess, application.data, isRestaurant, needsPin, router]);

  const data = useQuery({
    queryKey: ["provider", "restaurant-application", user?.id],
    queryFn: getMyRestaurantApplication,
    enabled: isRestaurant && !needsPin,
    staleTime: 0,
  });

  const loadingStep = requested ?? "profile";
  if ((application.isError || data.isError) && backend !== "checking") {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <AuthBanner>
          {(application.error ?? data.error)?.message || "We couldn’t load your application. Check your connection and refresh the page."}
        </AuthBanner>
      </AuthShell>
    );
  }
  if (loading || !isProvider || backend === "checking" || !application.data || !isRestaurant || needsPin || !data.data) {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <p className={styles.note} role="status">
          <LoaderCircle size={15} className="animate-spin" /> Loading your restaurant…
        </p>
      </AuthShell>
    );
  }

  const submitted = application.data.verificationStatus === "approved";
  const step = requested ?? (submitted ? "review" : firstOpenStep(data.data));
  // Keyed by tab only, so a background refetch never wipes what is being typed.
  return <StepPage key={step} step={step} app={data.data} approved={submitted} />;
}

type SaveFn = (next: RestaurantProfile, missing: string[]) => Promise<void>;

function StepPage({ step, app, approved }: { step: RestaurantStep; app: MyRestaurantApplication; approved: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const trackUpload = (on: boolean) => setUploading((n) => Math.max(0, n + (on ? 1 : -1)));

  /** Saves the restaurant, then opens the next tab. */
  const save: SaveFn = async (next, missing) => {
    setError("");
    if (missing.length) {
      setError(`Please add ${missing.join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      await saveRestaurant(app, next);
      await queryClient.invalidateQueries({ queryKey: ["provider"] });
      router.push(hrefFor(ORDER[ORDER.indexOf(step) + 1] ?? "review"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "We couldn’t save. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading > 0;
  return (
    <AuthShell
      wide
      caption={caption(step)}
      title={TITLES[step]}
      step={{ current: STEP_NO[step], total: RESTAURANT_STEP_TOTAL }}
      subtitle={SUBTITLES[step]}
      previous={previousStep("restaurant", step)}
      backHref="/"
      backLabel="Finish later"
    >
      <div className={styles.form}>
        {error ? <AuthBanner>{error}</AuthBanner> : null}
        {step === "profile" ? <ProfileStep app={app} busy={busy} saving={saving} uploading={uploading > 0} trackUpload={trackUpload} save={save} /> : null}
        {step === "menu" ? <MenuStep app={app} busy={busy} saving={saving} uploading={uploading > 0} trackUpload={trackUpload} save={save} /> : null}
        {step === "review" ? <ReviewStep app={app} approved={approved} /> : null}
      </div>
    </AuthShell>
  );
}

type StepProps = {
  app: MyRestaurantApplication;
  busy: boolean;
  saving: boolean;
  uploading: boolean;
  trackUpload: (on: boolean) => void;
  save: SaveFn;
};

/* ------------------------------------------------------------------ */
/* Step 5 · Your restaurant                                            */
/* ------------------------------------------------------------------ */

function ProfileStep({ app, busy, saving, uploading, trackUpload, save }: StepProps) {
  const [r, setR] = useState<RestaurantProfile>(app.restaurant);
  const [hours, setHours] = useState(() => parseHours(app.restaurant.hours));
  const set = (patch: Partial<RestaurantProfile>) => setR((prev) => ({ ...prev, ...patch }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const next = { ...r, restaurantName: r.restaurantName.trim(), hours: formatHours(hours) };

  return (
    <>
      <div className={v.summary}>
        <span className={v.summaryIcon}>
          <MapPin size={17} />
        </span>
        <span className={v.summaryText}>
          <small>Pinned on the map</small>
          <strong>{app.address || app.city || "Your restaurant"}</strong>
        </span>
        <Link href="/provider-application/location" className={v.summaryEdit}>
          <Pencil size={13} /> Change
        </Link>
      </div>

      <section className={v.section} aria-labelledby="r-photos">
        <Head n={1} id="r-photos" title="Photos" sub="Your best dish first — then the inside and the outside. The first photo is your cover." />
        <Gallery label="Restaurant photos *" images={r.images} onChange={(images) => set({ images })} trackUpload={trackUpload} folder="restaurants" />
      </section>

      <section className={v.section} aria-labelledby="r-about">
        <Head n={2} id="r-about" title="About your restaurant" sub="The name travellers will search for, and what makes you worth the stop" />
        <AuthField label="Restaurant name *" icon={UtensilsCrossed} value={r.restaurantName} onChange={(e) => set({ restaurantName: e.target.value })} />
        <span className={v.choiceLabel}>What food do you serve? *</span>
        <div className={v.chips} role="group" aria-label="Cuisines">
          {[...CUISINES, ...r.cuisineTypes.filter((c) => !CUISINES.includes(c))].map((c) => {
            const on = r.cuisineTypes.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => set({ cuisineTypes: toggle(r.cuisineTypes, c) })}>
                {on ? <BadgeCheck size={14} /> : null}
                {c}
              </button>
            );
          })}
        </div>
        <TextArea
          label="Short description *"
          value={r.description}
          onChange={(description) => set({ description })}
          max={500}
          min={30}
          placeholder="Family restaurant on the Karakoram Highway with a terrace view of Rakaposhi. Famous for chicken karahi and fresh apricot juice."
        />
      </section>

      <section className={v.section} aria-labelledby="r-hours">
        <Head n={3} id="r-hours" title="Opening hours" sub="Shown on your page so travellers know when to come" />
        <div className={v.chips} role="radiogroup" aria-label="Days open">
          {HOUR_DAYS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={hours.days === d} className={`${v.chip} ${hours.days === d ? v.chipOn : ""}`} onClick={() => setHours({ ...hours, days: d })}>
              {d}
            </button>
          ))}
          <button type="button" aria-pressed={hours.allDay} className={`${v.chip} ${hours.allDay ? v.chipOn : ""}`} onClick={() => setHours({ ...hours, allDay: !hours.allDay })}>
            <Clock3 size={13} /> Open 24 hours
          </button>
        </div>
        {!hours.allDay ? (
          <div className={g.times} style={{ justifyContent: "flex-start" }}>
            Opens
            <input type="time" className={g.time} aria-label="Opens at" value={hours.open} onChange={(e) => setHours({ ...hours, open: e.target.value })} />
            closes
            <input type="time" className={g.time} aria-label="Closes at" value={hours.close} onChange={(e) => setHours({ ...hours, close: e.target.value })} />
          </div>
        ) : null}
        <span className={styles.hint}>Shown as: {formatHours(hours)}</span>
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={() => void save(next, restaurantMissing(next))} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 · Menu & offers                                              */
/* ------------------------------------------------------------------ */

function MenuStep({ app, busy, saving, uploading, save }: StepProps) {
  const [dishes, setDishes] = useState<string[]>(app.restaurant.menuVariety);
  const [offers, setOffers] = useState<RestaurantOffer[]>(app.restaurant.offers);
  const ideas = [...new Set(app.restaurant.cuisineTypes.flatMap((c) => DISHES[c] ?? []))].filter((d) => !dishes.includes(d)).slice(0, 12);
  const setOffer = (id: string, patch: Partial<RestaurantOffer>) => setOffers((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const addOffer = (title = "") => setOffers((list) => [...list, { id: newOfferId(), title, type: "offer", active: true }]);
  const next: RestaurantProfile = { ...app.restaurant, menuVariety: dishes, offers: offers.filter((o) => o.title.trim()).map((o) => ({ ...o, title: o.title.trim() })) };

  return (
    <>
      <section className={v.section} aria-labelledby="r-menu">
        <Head n={1} id="r-menu" title="Popular dishes" sub="What people come for. Tap the ideas, or type your own." />
        <TagInput label="Dishes *" icon={UtensilsCrossed} values={dishes} onChange={setDishes} placeholder="e.g. Chicken karahi — press Enter" />
        {ideas.length ? (
          <div className={v.chips} role="group" aria-label="Dish ideas">
            {ideas.map((d) => (
              <button key={d} type="button" className={v.chip} onClick={() => setDishes((l) => [...l, d])}>
                <Plus size={13} /> {d}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className={v.section} aria-labelledby="r-offers">
        <Head n={2} id="r-offers" title="Deals & offers (optional)" sub="Shown with a badge on your page. Switch them off any time." />
        {offers.map((o) => (
          <div key={o.id} className={g.editor} style={{ borderColor: "#dfe6ef", background: "#fff" }}>
            <div className={g.langHead}>
              <strong style={{ fontSize: 14 }}>{o.title.trim() || "New offer"}</strong>
              <span className={g.cardActions}>
                <button type="button" className={g.smallButton} aria-pressed={o.active} onClick={() => setOffer(o.id, { active: !o.active })}>
                  {o.active ? "Live" : "Paused"}
                </button>
                <button type="button" className={g.remove} aria-label={`Remove ${o.title || "offer"}`} onClick={() => setOffers((l) => l.filter((x) => x.id !== o.id))}>
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
            <div className={v.options} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {OFFER_TYPES.map((t) => {
                const on = o.type === t.value;
                return (
                  <button key={t.value} type="button" role="radio" aria-checked={on} className={`${v.option} ${on ? v.optionOn : ""}`} onClick={() => setOffer(o.id, { type: t.value })}>
                    <span className={v.radio} aria-hidden="true" />
                    <span>
                      <strong>{t.label}</strong>
                      <span>{t.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={o.type === "discount" ? styles.row2 : undefined}>
              <AuthField label="Offer title" icon={Tag} placeholder="e.g. Lunch special" value={o.title} onChange={(e) => setOffer(o.id, { title: e.target.value })} />
              {o.type === "discount" ? (
                <AuthField
                  label="Discount %"
                  icon={Percent}
                  inputMode="numeric"
                  placeholder="20"
                  value={o.discountPercent != null ? String(o.discountPercent) : ""}
                  onChange={(e) => setOffer(o.id, { discountPercent: e.target.value ? Math.min(90, Number(e.target.value.replace(/\D/g, ""))) : undefined })}
                />
              ) : null}
            </div>
            <AuthField label="Details (optional)" icon={Pencil} placeholder="e.g. Mon–Fri, 12–3 pm, dine-in only" value={o.description ?? ""} onChange={(e) => setOffer(o.id, { description: e.target.value })} />
          </div>
        ))}
        <div className={v.chips}>
          <button type="button" className={g.addButton} onClick={() => addOffer()}>
            <Plus size={15} /> Add an offer
          </button>
          {offers.length ? null : OFFER_IDEAS.map((idea) => (
            <button key={idea} type="button" className={v.chip} onClick={() => addOffer(idea)}>
              <Plus size={13} /> {idea}
            </button>
          ))}
        </div>
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={() => void save(next, menuMissing(next))} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 7 · Review                                                     */
/* ------------------------------------------------------------------ */

function ReviewStep({ app, approved }: { app: MyRestaurantApplication; approved: boolean }) {
  const r = app.restaurant;
  const missing = [...restaurantMissing(r), ...menuMissing(r)];
  const live = r.offers.filter((o) => o.active);

  return (
    <>
      {approved ? (
        <div className={g.status}>
          <BadgeCheck size={20} />
          <div>
            <strong>Your restaurant is live</strong>
            <p>Travellers can find you now. Changes you save show on your page.</p>
          </div>
        </div>
      ) : missing.length ? (
        <div className={`${g.status} ${g.statusWarn}`}>
          <Clock3 size={20} />
          <div>
            <strong>Almost there</strong>
            <p>Before you submit, please add:</p>
            <ul className={g.missing}>
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className={g.status}>
          <Send size={20} />
          <div>
            <strong>Ready — our team will review your restaurant</strong>
            <p>Everything is saved. We usually review within 1–2 working days and let you know.</p>
          </div>
        </div>
      )}

      <ReviewCard step="profile" title="Your restaurant">
        {r.images[0] ? <img src={r.images[0]} alt="" style={{ width: "100%", maxWidth: 260, aspectRatio: "16 / 9", borderRadius: 14, objectFit: "cover" }} /> : null}
        <Line label="Name" value={r.restaurantName} />
        <Line label="Where" value={app.address || app.city} />
        <Line label="Food" value={r.cuisineTypes.join(", ")} />
        <Line label="Hours" value={r.hours} />
        <Line label="Photos" value={r.images.length ? `${r.images.length} photo(s)` : undefined} />
      </ReviewCard>

      <ReviewCard step="menu" title="Menu & offers">
        <Line label="Popular dishes" value={r.menuVariety.join(", ")} />
        <Line label="Live offers" value={live.length ? live.map((o) => (o.type === "discount" && o.discountPercent ? `${o.title} (${o.discountPercent}% off)` : o.title)).join(", ") : "None"} />
      </ReviewCard>

      <p className={v.draftNote}>
        <BadgeCheck size={13} /> CNIC checks with NADRA are coming soon — our team checks the owner’s CNIC during review.
      </p>

      <Link href="/provider" className={styles.primary} aria-disabled={missing.length > 0 && !approved} style={missing.length && !approved ? { pointerEvents: "none", opacity: 0.55 } : undefined}>
        {approved ? "Go to your dashboard" : "Done — go to your application status"} <ArrowRight size={16} />
      </Link>
    </>
  );
}

function ReviewCard({ step, title, children }: { step: RestaurantStep; title: string; children: ReactNode }) {
  return (
    <section className={v.section} aria-label={title}>
      <div className={v.summary} style={{ alignItems: "flex-start" }}>
        <span className={v.summaryIcon}>{STEP_NO[step]}</span>
        <div className={v.summaryText} style={{ display: "grid", gap: 6 }}>
          <strong>{title}</strong>
          {children}
        </div>
        <Link href={hrefFor(step)} className={v.summaryEdit}>
          <Pencil size={13} /> Edit
        </Link>
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value?: string }) {
  return (
    <span>
      <b style={{ color: "#242323", fontWeight: 600 }}>{label}:</b> {value?.trim() ? value : <em style={{ color: "#ba3b24" }}>missing</em>}
    </span>
  );
}
