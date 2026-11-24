"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock3,
  FileBadge,
  LoaderCircle,
  MapPin,
  Minus,
  Mountain,
  Pencil,
  Plus,
  Send,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { useBackendStatus, useQuery } from "@/lib/live-query";
import { TOUR_STEP_TOTAL, previousStep, type TourStep } from "@/lib/driver-steps";
import { getProviderApplication } from "@/services/customer/auth.service";
import {
  companyMissing,
  descriptionFor,
  getMyTourApplication,
  saveTour,
  saveTourCompany,
  tourMissing,
  type MyTourApplication,
  type TourCompany,
  type TourDay,
  type TourDifficulty,
  type TourItinerary,
  type TourType,
} from "@/services/customer/tour-application.service";
import { AuthShell } from "./auth-shell";
import { AuthBanner, AuthField } from "./auth-fields";
import { Gallery, Head, SaveButton, TagInput, TextArea } from "./form-bits";
import { PlaceField } from "./place-field";
import { PhotoUpload } from "./photo-upload";
import styles from "./auth.module.css";
import v from "./vehicle.module.css";
import g from "./guide.module.css";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

const ORDER: TourStep[] = ["company", "tour", "review"];
const STEP_NO: Record<TourStep, number> = { company: 4, tour: 5, review: 6 };
const TITLES: Record<TourStep, string> = {
  company: "Your tour company",
  tour: "Your first tour",
  review: "Review & submit",
};
const SUBTITLES: Record<TourStep, string> = {
  company: "Travellers compare operators before they book. Tell them who you are and where you take people.",
  tour: "Add one tour now so travellers have something to book. You can add more from your dashboard once you’re approved.",
  review: "Check everything before sending it to BANJARA. Our team usually reviews new operators within 1–2 working days.",
};

const REGIONS = ["Hunza", "Skardu", "Gilgit", "Nagar", "Fairy Meadows", "Deosai", "Chitral", "Swat", "Naran & Kaghan", "Neelum Valley", "K2 Base Camp", "Khunjerab"];
const STYLES = ["Treks", "Expeditions", "Summit climbs", "Jeep safaris", "Culture & history", "Family trips", "Honeymoon", "Photography", "Group tours", "Private tours"];
const LANGUAGES = ["Urdu", "English", "Burushaski", "Shina", "Wakhi", "Balti", "Chinese", "French", "German"];
const TYPES: Array<{ value: TourType; label: string; sub: string }> = [
  { value: "trek", label: "Trek", sub: "Walking routes, valleys, base camps" },
  { value: "expedition", label: "Expedition", sub: "Long, remote multi-day journeys" },
  { value: "summit", label: "Summit", sub: "Climbing a peak with a team" },
];
const DIFFICULTY: Array<{ value: TourDifficulty; label: string; sub: string }> = [
  { value: "easy", label: "Easy", sub: "Anyone in normal health" },
  { value: "moderate", label: "Moderate", sub: "Some fitness needed" },
  { value: "hard", label: "Hard", sub: "Fit and experienced" },
];
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
const INCLUDED = ["Transport", "Hotels", "Camping gear", "Meals", "Guide", "Porters", "Permits", "First aid kit"];
const EXCLUDED = ["Flights", "Personal expenses", "Travel insurance", "Tips", "Extra nights"];
const TYPE_WORD: Record<TourType, string> = { trek: "Trek", expedition: "Expedition", summit: "Summit Climb" };

const rupees = (value: number) => `Rs ${Math.round(value).toLocaleString("en-PK")}`;
const hrefFor = (step: TourStep) => `/provider-application/tours?step=${step}`;
const caption = (step: TourStep) => `Tour operator · Step ${STEP_NO[step]} of ${TOUR_STEP_TOTAL}`;

function firstOpenStep(app: MyTourApplication): TourStep {
  if (companyMissing(app.company).length) return "company";
  if (!app.tour || tourMissing(app.tour).length) return "tour";
  return "review";
}

/** Keeps the day plan the same length as the tour: adds or trims days, keeping what was typed. */
function resizeDays(days: TourDay[], count: number): TourDay[] {
  return Array.from({ length: count }, (_, i) => days[i] ?? { dayNumber: i + 1, title: "", description: "" }).map((d, i) => ({ ...d, dayNumber: i + 1 }));
}

const blankTour = (company: TourCompany): TourItinerary => ({
  title: "",
  tourType: "trek",
  summary: "",
  description: "",
  destination: company.operatingAreas[0] ?? "",
  durationDays: 3,
  durationNights: 2,
  difficulty: "moderate",
  maxParticipants: 12,
  pricePerPerson: 0,
  included: [],
  excluded: [],
  days: resizeDays([], 3),
  coverImage: "",
  images: [],
  departureLocation: "Islamabad",
  bestSeason: "Summer",
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Steps 4–6 for tour operators on the website: company profile, first tour, review. */
export function TourApplication({ requested }: { requested?: TourStep }) {
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
  const isOperator = Boolean(application.data?.services.includes("tour"));
  useEffect(() => {
    if (!application.isSuccess) return;
    if (!application.data) router.replace("/provider-application");
    else if (!isOperator) router.replace("/provider");
  }, [application.isSuccess, application.data, isOperator, router]);

  const data = useQuery({
    queryKey: ["provider", "tour-application", user?.id],
    queryFn: getMyTourApplication,
    enabled: isOperator,
    staleTime: 0,
  });

  const loadingStep = requested ?? "company";
  if ((application.isError || data.isError) && backend !== "checking") {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <AuthBanner>
          {(application.error ?? data.error)?.message || "We couldn’t load your application. Check your connection and refresh the page."}
        </AuthBanner>
      </AuthShell>
    );
  }
  if (loading || !isProvider || backend === "checking" || !application.data || !isOperator || !data.data) {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <p className={styles.note} role="status">
          <LoaderCircle size={15} className="animate-spin" /> Loading your application…
        </p>
      </AuthShell>
    );
  }

  const submitted = data.data.tour?.status === "pending" || data.data.tour?.status === "published";
  const step = requested ?? (submitted ? "review" : firstOpenStep(data.data));
  // Keyed by tab only, so a background refetch never wipes what is being typed.
  return <StepPage key={step} step={step} app={data.data} />;
}

type SaveFn = (work: () => Promise<void>, missing: string[], after?: TourStep) => Promise<void>;

function StepPage({ step, app }: { step: TourStep; app: MyTourApplication }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const trackUpload = (on: boolean) => setUploading((n) => Math.max(0, n + (on ? 1 : -1)));

  /** Runs a save, then opens the next tab (or `after`). */
  const save: SaveFn = async (work, missing, after) => {
    setError("");
    if (missing.length) {
      setError(`Please add ${missing.join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      await work();
      await queryClient.invalidateQueries({ queryKey: ["provider"] });
      router.push(hrefFor(after ?? ORDER[ORDER.indexOf(step) + 1] ?? "review"));
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
      step={{ current: STEP_NO[step], total: TOUR_STEP_TOTAL }}
      subtitle={SUBTITLES[step]}
      previous={previousStep("tour", step)}
      backHref="/"
      backLabel="Finish later"
    >
      <div className={styles.form}>
        {error ? <AuthBanner>{error}</AuthBanner> : null}
        {step === "company" ? <CompanyStep app={app} busy={busy} saving={saving} uploading={uploading > 0} trackUpload={trackUpload} save={save} /> : null}
        {step === "tour" ? <TourStepForm app={app} busy={busy} saving={saving} uploading={uploading > 0} trackUpload={trackUpload} save={save} /> : null}
        {step === "review" ? <ReviewStep app={app} busy={busy} saving={saving} save={save} /> : null}
      </div>
    </AuthShell>
  );
}

type StepProps = {
  app: MyTourApplication;
  busy: boolean;
  saving: boolean;
  uploading: boolean;
  trackUpload: (on: boolean) => void;
  save: SaveFn;
};

/* ------------------------------------------------------------------ */
/* Step 4 · Company                                                    */
/* ------------------------------------------------------------------ */

function CompanyStep({ app, busy, saving, uploading, trackUpload, save }: StepProps) {
  const [c, setC] = useState<TourCompany>({ ...app.company, companyName: app.company.companyName || app.businessName });
  const [regionQuery, setRegionQuery] = useState("");
  const set = (patch: Partial<TourCompany>) => setC((prev) => ({ ...prev, ...patch }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  return (
    <>
      <section className={v.section} aria-labelledby="t-who">
        <Head n={1} id="t-who" title="Who you are" sub="Your company name and logo appear on every tour" />
        <AuthField label="Company name *" icon={Building2} value={c.companyName} onChange={(e) => set({ companyName: e.target.value })} />
        <div style={{ maxWidth: 260 }}>
          <PhotoUpload label="Logo (optional)" hint="Square works best" folder="logos" value={c.logo} onChange={(logo) => set({ logo })} onBusyChange={trackUpload} />
        </div>
        <TextArea
          label="About your company *"
          value={c.description}
          onChange={(description) => set({ description })}
          max={600}
          min={30}
          placeholder="Family-run operator from Skardu since 2012. We run small-group treks to K2 Base Camp and Deosai with local porters and certified guides."
        />
        <div style={{ maxWidth: 280 }}>
          <AuthField
            label="Years in business"
            icon={CalendarDays}
            inputMode="numeric"
            value={c.yearsExperience != null ? String(c.yearsExperience) : ""}
            onChange={(e) => set({ yearsExperience: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })}
          />
        </div>
      </section>

      <section className={v.section} aria-labelledby="t-where">
        <Head n={2} id="t-where" title="Where do you run tours?" sub="Tap the regions, or search for others" />
        <div className={v.chips} role="group" aria-label="Regions">
          {[...REGIONS, ...c.operatingAreas.filter((a) => !REGIONS.includes(a))].map((area) => {
            const on = c.operatingAreas.includes(area);
            return (
              <button key={area} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => set({ operatingAreas: toggle(c.operatingAreas, area) })}>
                <MapPin size={13} />
                {area}
              </button>
            );
          })}
        </div>
        <PlaceField
          label="Add another region"
          value={regionQuery}
          onChange={setRegionQuery}
          onPick={(_p, value) => {
            if (value && !c.operatingAreas.includes(value)) set({ operatingAreas: [...c.operatingAreas, value] });
            setRegionQuery("");
          }}
          popular={[]}
          placeholder="Search any valley or town"
        />
      </section>

      <section className={v.section} aria-labelledby="t-what">
        <Head n={3} id="t-what" title="What kind of tours?" sub="Choose all that fit" />
        <div className={v.chips} role="group" aria-label="Tour styles">
          {STYLES.map((style) => {
            const on = c.specialties.includes(style);
            return (
              <button key={style} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => set({ specialties: toggle(c.specialties, style) })}>
                {on ? <BadgeCheck size={14} /> : null}
                {style}
              </button>
            );
          })}
        </div>
        <span className={v.choiceLabel}>Languages your team speaks</span>
        <div className={v.chips} role="group" aria-label="Languages">
          {[...LANGUAGES, ...c.languages.filter((l) => !LANGUAGES.includes(l))].map((lang) => {
            const on = c.languages.includes(lang);
            return (
              <button key={lang} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => set({ languages: toggle(c.languages, lang) })}>
                {on ? <BadgeCheck size={14} /> : null}
                {lang}
              </button>
            );
          })}
        </div>
      </section>

      <section className={v.section} aria-labelledby="t-trust">
        <Head n={4} id="t-trust" title="Licence & photos (optional)" sub="Travellers trust licensed operators. Only the number is shown to our team." />
        <div style={{ maxWidth: 360 }}>
          <AuthField label="Tourism / DTS licence number" icon={FileBadge} placeholder="e.g. GB-DTS-1234" value={c.licence} onChange={(e) => set({ licence: e.target.value })} />
        </div>
        <Gallery label="Company photos" images={c.images} onChange={(images) => set({ images })} trackUpload={trackUpload} folder="tours" />
      </section>

      <SaveButton
        busy={busy}
        saving={saving}
        uploading={uploading}
        onClick={() => void save(() => saveTourCompany(c, app.rawTourDetails, app.tour), companyMissing(c))}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 · First tour                                                 */
/* ------------------------------------------------------------------ */

function TourStepForm({ app, busy, saving, uploading, trackUpload, save }: StepProps) {
  const [t, setT] = useState<TourItinerary>(() => {
    const saved = app.tour;
    return saved ? { ...saved, days: resizeDays(saved.days, saved.durationDays) } : blankTour(app.company);
  });
  const set = (patch: Partial<TourItinerary>) => setT((prev) => ({ ...prev, ...patch }));
  const setDays = (count: number) => {
    const n = Math.max(1, Math.min(30, count));
    set({ durationDays: n, durationNights: Math.max(0, n - 1), days: resizeDays(t.days, n) });
  };
  // From the latest state, so quick edits to several days never overwrite each other.
  const setDay = (index: number, patch: Partial<TourDay>) =>
    setT((prev) => ({ ...prev, days: prev.days.map((d, i) => (i === index ? { ...d, ...patch } : d)) }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const seasons = (t.bestSeason ?? "").split(/,\s*/).filter(Boolean);
  const ideas = [...new Set([t.destination, ...app.company.operatingAreas].filter(Boolean))]
    .slice(0, 3)
    .map((place) => `${place} ${TYPE_WORD[t.tourType]} — ${t.durationDays} Days`);

  const onSave = () => {
    // The cover photo always leads the gallery.
    const images = [t.coverImage, ...t.images.filter((u) => u && u !== t.coverImage)].filter(Boolean);
    const ready = { ...t, title: t.title.trim(), images, description: descriptionFor(t) };
    void save(async () => {
      const savedTour = await saveTour(ready);
      // Keep the company's summary fields (older catalog cards) in step with this tour.
      await saveTourCompany(app.company, app.rawTourDetails, savedTour);
    }, tourMissing(ready));
  };

  return (
    <>
      {app.tour?.status === "rejected" && app.tour.rejectionReason ? (
        <div className={`${g.status} ${g.statusWarn}`}>
          <Pencil size={20} />
          <div>
            <strong>BANJARA asked for changes to this tour</strong>
            <p>{app.tour.rejectionReason}</p>
          </div>
        </div>
      ) : null}

      <section className={v.section} aria-labelledby="t-basics">
        <Head n={1} id="t-basics" title="The basics" sub="What travellers see first" />
        <div className={styles.field}>
          <span className={v.choiceLabel}>Type of tour</span>
          <div className={v.options} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {TYPES.map((type) => {
              const on = t.tourType === type.value;
              return (
                <button key={type.value} type="button" role="radio" aria-checked={on} className={`${v.option} ${on ? v.optionOn : ""}`} onClick={() => set({ tourType: type.value })}>
                  <span className={v.radio} aria-hidden="true" />
                  <span>
                    <strong>{type.label}</strong>
                    <span>{type.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <PlaceField label="Destination *" value={t.destination} onChange={(destination) => set({ destination })} popular={app.company.operatingAreas.length ? app.company.operatingAreas : undefined} placeholder="Where does the tour go?" />
        <AuthField label="Tour name *" icon={Mountain} placeholder="e.g. Deosai Plains Trek — 4 Days" value={t.title} onChange={(e) => set({ title: e.target.value })} />
        {!t.title.trim() && ideas.length ? (
          <div className={v.chips} role="group" aria-label="Name ideas">
            {ideas.map((idea) => (
              <button key={idea} type="button" className={v.chip} onClick={() => set({ title: idea })}>
                <Plus size={13} /> {idea}
              </button>
            ))}
          </div>
        ) : null}
        <TextArea label="One-line summary *" value={t.summary} onChange={(summary) => set({ summary })} max={300} min={10} placeholder="Walk across the second-highest plateau on earth, camp under the stars and spot Himalayan brown bears." />
      </section>

      <section className={v.section} aria-labelledby="t-size">
        <Head n={2} id="t-size" title="Length, difficulty & price" sub="Travellers filter tours by these" />
        <div className={styles.field}>
          <span className={v.choiceLabel}>How many days?</span>
          <div className={v.stepper}>
            <button type="button" aria-label="One day less" disabled={t.durationDays <= 1} onClick={() => setDays(t.durationDays - 1)}>
              <Minus size={16} />
            </button>
            <input className={v.stepperValue} inputMode="numeric" aria-label="Days" value={t.durationDays} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 1)} />
            <button type="button" aria-label="One day more" disabled={t.durationDays >= 30} onClick={() => setDays(t.durationDays + 1)}>
              <Plus size={16} />
            </button>
          </div>
          <span className={styles.hint}>
            {t.durationDays} day{t.durationDays === 1 ? "" : "s"} · {t.durationNights ?? 0} night{t.durationNights === 1 ? "" : "s"}
          </span>
        </div>
        <div className={styles.field}>
          <span className={v.choiceLabel}>Difficulty</span>
          <div className={v.options} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {DIFFICULTY.map((d) => {
              const on = t.difficulty === d.value;
              return (
                <button key={d.value} type="button" role="radio" aria-checked={on} className={`${v.option} ${on ? v.optionOn : ""}`} onClick={() => set({ difficulty: d.value })}>
                  <span className={v.radio} aria-hidden="true" />
                  <span>
                    <strong>{d.label}</strong>
                    <span>{d.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.row2}>
          <AuthField label="Price per person (Rs) *" icon={Wallet} inputMode="numeric" placeholder="e.g. 45000" value={t.pricePerPerson ? String(t.pricePerPerson) : ""} onChange={(e) => set({ pricePerPerson: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          <AuthField label="Max group size *" icon={Users} inputMode="numeric" value={String(t.maxParticipants)} onChange={(e) => set({ maxParticipants: Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
        </div>
        <PlaceField label="Starts from" value={t.departureLocation ?? ""} onChange={(departureLocation) => set({ departureLocation })} placeholder="e.g. Islamabad, Gilgit" />
        <div className={styles.field}>
          <span className={v.choiceLabel}>Best season</span>
          <div className={v.chips} role="group" aria-label="Best season">
            {SEASONS.map((s) => {
              const on = seasons.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => set({ bestSeason: toggle(seasons, s).sort((a, b) => SEASONS.indexOf(a) - SEASONS.indexOf(b)).join(", ") })}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={v.section} aria-labelledby="t-plan">
        <Head n={3} id="t-plan" title="Day-by-day plan" sub="A title for each day; add details if you like. It grows with the number of days." />
        {t.days.map((day, index) => (
          <div key={day.dayNumber} className={g.langRow}>
            <div className={g.langHead}>
              <strong>Day {day.dayNumber}</strong>
              <Clock3 size={14} color="#617185" aria-hidden="true" />
            </div>
            <AuthField
              label={`Day ${day.dayNumber} title`}
              icon={MapPin}
              placeholder={index === 0 ? "e.g. Drive Islamabad → Chilas" : index === t.days.length - 1 ? "e.g. Return to Skardu" : "e.g. Trek to Bara Pani camp"}
              value={day.title}
              onChange={(e) => setDay(index, { title: e.target.value })}
            />
            <TextArea label="What happens (optional)" value={day.description} onChange={(description) => setDay(index, { description })} max={600} placeholder="Distance, hours of walking, where you sleep, meals…" />
          </div>
        ))}
      </section>

      <section className={v.section} aria-labelledby="t-incl">
        <Head n={4} id="t-incl" title="What’s included?" sub="Tap the common ones, or type your own" />
        <TagInput label="Included" icon={BadgeCheck} values={t.included} onChange={(included) => set({ included })} placeholder="Type and press Enter" />
        <div className={v.chips}>
          {INCLUDED.filter((i) => !t.included.includes(i)).map((i) => (
            <button key={i} type="button" className={v.chip} onClick={() => set({ included: [...t.included, i] })}>
              <Plus size={13} /> {i}
            </button>
          ))}
        </div>
        <TagInput label="Not included" icon={X} values={t.excluded} onChange={(excluded) => set({ excluded })} placeholder="Type and press Enter" />
        <div className={v.chips}>
          {EXCLUDED.filter((i) => !t.excluded.includes(i)).map((i) => (
            <button key={i} type="button" className={v.chip} onClick={() => set({ excluded: [...t.excluded, i] })}>
              <Plus size={13} /> {i}
            </button>
          ))}
        </div>
      </section>

      <section className={v.section} aria-labelledby="t-photos">
        <Head n={5} id="t-photos" title="Photos" sub="A cover photo is required. Real photos from your trips work best." />
        <div style={{ maxWidth: 320 }}>
          <PhotoUpload label="Cover photo" required folder="tours" value={t.coverImage} onChange={(coverImage) => set({ coverImage })} onBusyChange={trackUpload} />
        </div>
        <Gallery label="More photos (optional)" images={t.images.filter((u) => u !== t.coverImage)} onChange={(images) => set({ images })} trackUpload={trackUpload} folder="tours" />
        <TextArea label="Full description (optional)" value={t.description} onChange={(description) => set({ description })} max={4000} placeholder="Anything else travellers should know: fitness, gear list, cancellation, altitude…" />
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={onSave} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 · Review                                                     */
/* ------------------------------------------------------------------ */

function ReviewStep({ app, busy, saving, save }: { app: MyTourApplication; busy: boolean; saving: boolean; save: SaveFn }) {
  const c = app.company;
  const t = app.tour;
  const missing = [...companyMissing(c), ...(t ? tourMissing(t) : ["your first tour"])];
  const status = t?.status;

  return (
    <>
      {status === "published" ? (
        <div className={g.status}>
          <BadgeCheck size={20} />
          <div>
            <strong>Your tour is live</strong>
            <p>Travellers can book it now. Add more tours from your dashboard.</p>
          </div>
        </div>
      ) : status === "pending" ? (
        <div className={g.status}>
          <Send size={20} />
          <div>
            <strong>Submitted — we’re reviewing your company and tour</strong>
            <p>We’ll let you know within 1–2 working days. You can still edit below.</p>
          </div>
        </div>
      ) : status === "rejected" ? (
        <div className={`${g.status} ${g.statusWarn}`}>
          <Pencil size={20} />
          <div>
            <strong>BANJARA asked for changes</strong>
            <p>{t?.rejectionReason || "Update your tour, then submit it again."}</p>
          </div>
        </div>
      ) : null}

      {missing.length ? (
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
      ) : null}

      <ReviewCard step="company" title="Company profile">
        {c.logo ? <img src={c.logo} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover" }} /> : null}
        <Line label="Company" value={c.companyName} />
        <Line label="Regions" value={c.operatingAreas.join(", ")} />
        <Line label="Tours" value={c.specialties.join(", ")} />
        <Line label="Languages" value={c.languages.join(", ") || "—"} />
        <Line label="Licence" value={c.licence || "Not added"} />
      </ReviewCard>

      <ReviewCard step="tour" title="Your first tour">
        {t?.coverImage ? <img src={t.coverImage} alt="" style={{ width: "100%", maxWidth: 260, aspectRatio: "16 / 9", borderRadius: 14, objectFit: "cover" }} /> : null}
        <Line label="Tour" value={t?.title} />
        <Line label="Where" value={[t?.destination, t?.departureLocation ? `from ${t.departureLocation}` : ""].filter(Boolean).join(" ")} />
        <Line label="Length" value={t ? `${t.durationDays} days · ${DIFFICULTY.find((d) => d.value === t.difficulty)?.label ?? "Moderate"}` : undefined} />
        <Line label="Price" value={t?.pricePerPerson ? `${rupees(t.pricePerPerson)} per person · up to ${t.maxParticipants}` : undefined} />
        <Line label="Plan" value={t?.days.length ? t.days.map((d) => `Day ${d.dayNumber}: ${d.title}`).join(" · ") : undefined} />
      </ReviewCard>

      <p className={v.draftNote}>
        <BadgeCheck size={13} /> CNIC checks with NADRA are coming soon — our team checks the owner’s CNIC during review.
      </p>

      {status === "pending" || status === "published" ? (
        <Link href="/provider" className={styles.primary}>
          Go to your dashboard <ArrowRight size={16} />
        </Link>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled={busy || missing.length > 0 || !t}
          onClick={() => t && void save(async () => void (await saveTour({ ...t, description: descriptionFor(t) }, true)), missing, "review")}
        >
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          {saving ? "Submitting…" : status === "rejected" ? "Submit again" : "Submit for review"}
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ReviewCard({ step, title, children }: { step: TourStep; title: string; children: ReactNode }) {
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
