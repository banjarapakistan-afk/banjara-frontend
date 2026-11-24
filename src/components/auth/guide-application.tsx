"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarX,
  Clock3,
  Compass,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { useBackendStatus, useQuery } from "@/lib/live-query";
import { GUIDE_STEP_TOTAL, previousStep, type GuideStep } from "@/lib/driver-steps";
import { getProviderApplication } from "@/services/customer/auth.service";
import {
  WEEKDAYS,
  getMyGuide,
  newGuideId,
  profileMissing,
  saveGuide,
  scheduleMissing,
  servicesMissing,
  type GuideDay,
  type GuideDetails,
  type GuideDocumentType,
  type GuidePricingType,
  type GuideService,
  type GuideType,
  type LanguageProficiency,
} from "@/services/customer/guide-application.service";
import { AuthShell } from "./auth-shell";
import { AuthBanner, AuthField } from "./auth-fields";
import { PlaceField } from "./place-field";
import { PhotoUpload } from "./photo-upload";
import { Head, SaveButton, TagInput, TextArea } from "./form-bits";
import styles from "./auth.module.css";
import v from "./vehicle.module.css";
import g from "./guide.module.css";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

const ORDER: GuideStep[] = ["profile", "services", "schedule", "photos", "review"];
const STEP_NO: Record<GuideStep, number> = { profile: 4, services: 5, schedule: 6, photos: 7, review: 8 };
const TITLES: Record<GuideStep, string> = {
  profile: "Your guide profile",
  services: "Services & prices",
  schedule: "When you’re available",
  photos: "Photos & documents",
  review: "Review & submit",
};
const SUBTITLES: Record<GuideStep, string> = {
  profile: "This is what travellers read before they hire you. A clear photo and a friendly bio make the biggest difference.",
  services: "Add what travellers can book — a city walk, a day trek, a photo tour. Or just set a daily rate.",
  schedule: "Travellers can only book you on these days and hours. You can change them any time.",
  photos: "Photos of your trips help travellers picture the day. Certificates are optional but earn trust.",
  review: "Check everything before sending it to BANJARA. Our team usually reviews guides within 1–2 working days.",
};

const GUIDE_TYPES: Array<{ value: GuideType; label: string }> = [
  { value: "local", label: "Local guide" },
  { value: "tour", label: "Tour guide" },
  { value: "trekking", label: "Trekking" },
  { value: "hiking", label: "Hiking" },
  { value: "cultural", label: "Culture & history" },
  { value: "adventure", label: "Adventure" },
  { value: "mountain", label: "Mountaineering" },
  { value: "photography", label: "Photography" },
  { value: "other", label: "Other" },
];
const TYPE_LABEL = Object.fromEntries(GUIDE_TYPES.map((t) => [t.value, t.label])) as Record<string, string>;

const AREAS = ["Hunza", "Gilgit", "Skardu", "Nagar", "Fairy Meadows", "Naltar", "Khunjerab", "Ghizer", "Astore", "Chitral", "Swat", "Naran"];
const LANGUAGES = ["Urdu", "English", "Burushaski", "Shina", "Wakhi", "Balti", "Khowar", "Pashto", "Punjabi", "Chinese"];
const LEVELS: Array<{ value: LanguageProficiency; label: string }> = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Good" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
];
const PRICING: Array<{ value: GuidePricingType; label: string; sub: string }> = [
  { value: "per_person", label: "Per person", sub: "Each traveller pays" },
  { value: "per_group", label: "Per group", sub: "One price for the whole group" },
  { value: "per_day", label: "Per day", sub: "A fixed price for each day" },
  { value: "per_hour", label: "Per hour", sub: "Charged by the hour" },
];
const PRICING_SHORT: Record<string, string> = {
  per_person: "per person",
  per_group: "per group",
  per_day: "per day",
  per_hour: "per hour",
  custom: "",
};
const DURATIONS = [
  { label: "2 hours", hours: 2 },
  { label: "Half day", hours: 4 },
  { label: "Full day", hours: 8 },
  { label: "2 days", hours: 16 },
  { label: "3+ days", hours: 24 },
];
const NOTICE = [
  { hours: 0, label: "Same day" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "1 day" },
  { hours: 48, label: "2 days" },
];
const DOCS: Array<{ type: GuideDocumentType; label: string; hint: string }> = [
  { type: "guide_license", label: "Guide licence", hint: "From the tourism department" },
  { type: "tourism_cert", label: "Tourism certificate", hint: "Courses or training you’ve done" },
  { type: "first_aid", label: "First aid", hint: "Any first-aid card or certificate" },
];

const rupees = (value: number) => `Rs ${Math.round(value).toLocaleString("en-PK")}`;
const hrefFor = (step: GuideStep) => `/provider-application/guide?step=${step}`;
const caption = (step: GuideStep) => `Travel guide · Step ${STEP_NO[step]} of ${GUIDE_STEP_TOTAL}`;

/** First tab that still needs something, so a returning guide carries on where they left off. */
function firstOpenStep(guide: GuideDetails): GuideStep {
  if (profileMissing(guide).length) return "profile";
  if (servicesMissing(guide).length) return "services";
  if (scheduleMissing(guide).length) return "schedule";
  return "review";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Steps 4–8 for travel guides on the website: profile, services, availability, photos, review. */
export function GuideApplication({ requested }: { requested?: GuideStep }) {
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
  const isGuide = Boolean(application.data?.services.includes("travelGuide"));
  useEffect(() => {
    if (!application.isSuccess) return;
    if (!application.data) router.replace("/provider-application");
    else if (!isGuide) router.replace("/provider");
  }, [application.isSuccess, application.data, isGuide, router]);

  const guide = useQuery({
    queryKey: ["provider", "guide", user?.id],
    queryFn: getMyGuide,
    enabled: isGuide,
    staleTime: 0,
  });

  const loadingStep = requested ?? "profile";
  if ((application.isError || guide.isError) && backend !== "checking") {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <AuthBanner>
          {(application.error ?? guide.error)?.message ||
            "We couldn’t load your guide profile. Check your connection and refresh the page."}
        </AuthBanner>
      </AuthShell>
    );
  }
  if (loading || !isProvider || backend === "checking" || !application.data || !isGuide || !guide.data) {
    return (
      <AuthShell caption={caption(loadingStep)} title={TITLES[loadingStep]}>
        <p className={styles.note} role="status">
          <LoaderCircle size={15} className="animate-spin" /> Loading your guide profile…
        </p>
      </AuthShell>
    );
  }

  const data = guide.data;
  const submitted = data.guide.profileStatus === "pending" || data.guide.profileStatus === "approved";
  const step = requested ?? (submitted ? "review" : firstOpenStep(data.guide));
  // Each tab starts from the saved profile when it opens (saving refetches before moving on).
  // Keyed by tab only, so a background refetch never wipes what the guide is typing.
  return <StepPage key={step} step={step} data={data} userId={user.id} />;
}

function StepPage({ step, data, userId }: { step: GuideStep; data: Awaited<ReturnType<typeof getMyGuide>>; userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const trackUpload = (on: boolean) => setUploading((n) => Math.max(0, n + (on ? 1 : -1)));

  /** Saves this tab's part of the profile, then opens the next tab. */
  const save = async (patch: Partial<GuideDetails>, missing: string[], submit = false) => {
    setError("");
    if (missing.length) {
      setError(`Please add ${missing.join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      await saveGuide(patch, submit);
      await queryClient.invalidateQueries({ queryKey: ["provider", "guide", userId] });
      if (submit) {
        await queryClient.invalidateQueries({ queryKey: ["provider"] });
        router.replace(hrefFor("review"));
      } else {
        router.push(hrefFor(ORDER[ORDER.indexOf(step) + 1] ?? "review"));
      }
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "We couldn’t save. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading > 0;
  const common = { guide: data.guide, busy, saving, uploading: uploading > 0, trackUpload, save };

  return (
    <AuthShell
      wide
      caption={caption(step)}
      title={TITLES[step]}
      step={{ current: STEP_NO[step], total: GUIDE_STEP_TOTAL }}
      subtitle={SUBTITLES[step]}
      previous={previousStep("guide", step)}
      backHref="/"
      backLabel="Finish later"
    >
      <div className={styles.form}>
        {error ? <AuthBanner>{error}</AuthBanner> : null}
        {step === "profile" ? <ProfileStep {...common} /> : null}
        {step === "services" ? <ServicesStep {...common} /> : null}
        {step === "schedule" ? <ScheduleStep {...common} /> : null}
        {step === "photos" ? <PhotosStep {...common} /> : null}
        {step === "review" ? <ReviewStep {...common} ownerName={data.ownerName} city={data.city} /> : null}
      </div>
    </AuthShell>
  );
}

type StepProps = {
  guide: GuideDetails;
  busy: boolean;
  saving: boolean;
  uploading: boolean;
  trackUpload: (on: boolean) => void;
  save: (patch: Partial<GuideDetails>, missing: string[], submit?: boolean) => Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Step 4 · Profile                                                    */
/* ------------------------------------------------------------------ */

function ProfileStep({ guide, busy, saving, uploading, trackUpload, save }: StepProps) {
  const [photo, setPhoto] = useState(guide.profilePhoto ?? "");
  const [types, setTypes] = useState<GuideType[]>(guide.guideTypes ?? []);
  const [areas, setAreas] = useState<string[]>(guide.areasCovered ?? []);
  const [areaQuery, setAreaQuery] = useState("");
  const [languages, setLanguages] = useState(guide.languages?.length ? guide.languages : [{ language: "Urdu", proficiency: "native" as LanguageProficiency }]);
  const [otherLanguage, setOtherLanguage] = useState("");
  const [bio, setBio] = useState(guide.shortBio ?? "");
  const [story, setStory] = useState(guide.detailedDescription ?? "");
  const [skills, setSkills] = useState<string[]>(guide.specialSkills ?? []);
  const [certs, setCerts] = useState<string[]>(guide.certifications ?? []);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const hasLanguage = (name: string) => languages.some((l) => l.language.toLowerCase() === name.toLowerCase());
  const addLanguage = (name: string) => {
    const clean = name.trim();
    if (!clean || hasLanguage(clean)) return;
    setLanguages((list) => [...list, { language: clean, proficiency: "conversational" }]);
  };
  const addArea = (name: string) => {
    const clean = name.trim();
    if (clean && !areas.some((a) => a.toLowerCase() === clean.toLowerCase())) setAreas((list) => [...list, clean]);
    setAreaQuery("");
  };

  const patch: Partial<GuideDetails> = {
    profilePhoto: photo,
    guideTypes: types,
    areasCovered: areas,
    languages: languages.filter((l) => l.language.trim()),
    shortBio: bio.trim(),
    detailedDescription: story.trim() || undefined,
    specialSkills: skills,
    certifications: certs,
  };

  return (
    <>
      <section className={v.section} aria-labelledby="g-photo">
        <Head n={1} id="g-photo" title="Your photo" sub="A clear, friendly photo of your face — no sunglasses" />
        <div style={{ maxWidth: 260 }}>
          <PhotoUpload label="Profile photo" required folder="guides" value={photo} onChange={setPhoto} onBusyChange={trackUpload} />
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-kind">
        <Head n={2} id="g-kind" title="What kind of guide are you?" sub="Choose all that fit" />
        <div className={v.chips} role="group" aria-label="Guide types">
          {GUIDE_TYPES.map((t) => {
            const on = types.includes(t.value);
            return (
              <button key={t.value} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => setTypes((l) => toggle(l, t.value))}>
                {on ? <BadgeCheck size={14} /> : null}
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-areas">
        <Head n={3} id="g-areas" title="Where do you guide?" sub="Tap the places you know well, or search for others" />
        <div className={v.chips} role="group" aria-label="Areas you cover">
          {[...AREAS, ...areas.filter((a) => !AREAS.includes(a))].map((area) => {
            const on = areas.includes(area);
            return (
              <button key={area} type="button" aria-pressed={on} className={`${v.chip} ${on ? v.chipOn : ""}`} onClick={() => setAreas((l) => toggle(l, area))}>
                <MapPin size={13} />
                {area}
              </button>
            );
          })}
        </div>
        <PlaceField
          label="Add another place"
          value={areaQuery}
          onChange={setAreaQuery}
          onPick={(_place, value) => addArea(value)}
          placeholder="Search any valley, town or village"
          popular={[]}
          hint="Pick from the list to add it."
        />
      </section>

      <section className={v.section} aria-labelledby="g-lang">
        <Head n={4} id="g-lang" title="Languages you speak" sub="Travellers filter guides by language" />
        <div className={v.chips} role="group" aria-label="Add a language">
          {LANGUAGES.filter((name) => !hasLanguage(name)).map((name) => (
            <button key={name} type="button" className={v.chip} onClick={() => addLanguage(name)}>
              <Plus size={13} /> {name}
            </button>
          ))}
        </div>
        {languages.map((row, index) => (
          <div key={`${row.language}-${index}`} className={g.langRow}>
            <div className={g.langHead}>
              <strong>{row.language}</strong>
              <button type="button" className={g.remove} aria-label={`Remove ${row.language}`} onClick={() => setLanguages((l) => l.filter((_, i) => i !== index))}>
                <X size={15} />
              </button>
            </div>
            <div className={g.levels} role="radiogroup" aria-label={`${row.language} level`}>
              {LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={row.proficiency === level.value}
                  className={`${g.level} ${row.proficiency === level.value ? g.levelOn : ""}`}
                  onClick={() => setLanguages((l) => l.map((x, i) => (i === index ? { ...x, proficiency: level.value } : x)))}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className={g.addRow}>
          <AuthField
            label="Other language"
            icon={Plus}
            value={otherLanguage}
            placeholder="e.g. French"
            onChange={(event) => setOtherLanguage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLanguage(otherLanguage);
                setOtherLanguage("");
              }
            }}
          />
          <button type="button" className={g.addButton} style={{ alignSelf: "end" }} disabled={!otherLanguage.trim()} onClick={() => { addLanguage(otherLanguage); setOtherLanguage(""); }}>
            <Plus size={15} /> Add
          </button>
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-bio">
        <Head n={5} id="g-bio" title="About you" sub="Write like you’d introduce yourself to a traveller" />
        <TextArea
          label="Short bio *"
          value={bio}
          onChange={setBio}
          max={300}
          min={30}
          placeholder="Born and raised in Karimabad. I’ve guided treks to Rakaposhi base camp for 8 years and love showing visitors our apricot orchards and Baltit Fort."
        />
        <TextArea
          label="More about your tours (optional)"
          value={story}
          onChange={setStory}
          max={1500}
          placeholder="What a typical day with you looks like, what makes your tours different, safety, gear you provide…"
        />
        <TagInput label="Special skills (optional)" icon={Award} values={skills} onChange={setSkills} placeholder="e.g. Glacier walks, wildlife spotting — press Enter" />
        <TagInput label="Certifications & training (optional)" icon={BadgeCheck} values={certs} onChange={setCerts} placeholder="e.g. Wilderness first aid — press Enter" />
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={() => void save(patch, profileMissing({ ...guide, ...patch }))} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 · Services                                                   */
/* ------------------------------------------------------------------ */

type ServiceDraft = {
  id?: string;
  name: string;
  /** Kept from a saved service; new services use the type chosen on the profile step. */
  category?: GuideType;
  description: string;
  durationLabel: string;
  durationHours?: number;
  price: string;
  pricingType: GuidePricingType;
  maxGuests: string;
  included: string[];
};

const blankService = (): ServiceDraft => ({
  name: "",
  description: "",
  durationLabel: "Full day",
  durationHours: 8,
  price: "",
  pricingType: "per_person",
  maxGuests: "8",
  included: [],
});

/** Words for one-tap service names, from the guide's own types ("Hunza day tour", "Nagar trek"). */
const NAME_WORD: Record<GuideType, string> = {
  local: "day tour",
  tour: "guided tour",
  trekking: "trek",
  hiking: "hike",
  cultural: "culture & history walk",
  adventure: "adventure day",
  mountain: "mountain expedition",
  photography: "photo tour",
  other: "tour",
};
const INCLUDED_IDEAS = ["Entry tickets", "Tea & snacks", "Lunch", "Transport", "Photos of your trip", "Trekking poles"];

function nameIdeas(guide: GuideDetails, taken: string[]) {
  const areas = (guide.areasCovered ?? []).slice(0, 3);
  const types = (guide.guideTypes?.length ? guide.guideTypes : (["local"] as GuideType[])).slice(0, 2);
  const ideas = areas.flatMap((area) => types.map((t) => `${area} ${NAME_WORD[t]}`));
  return ideas.filter((idea) => !taken.some((t) => t.toLowerCase() === idea.toLowerCase())).slice(0, 4);
}

function ServicesStep({ guide, busy, saving, uploading, save }: StepProps) {
  const [services, setServices] = useState<GuideService[]>(guide.services ?? []);
  const [daily, setDaily] = useState(guide.dailyHireRate ? String(guide.dailyHireRate) : "");
  const [editing, setEditing] = useState<ServiceDraft | null>(guide.services?.length ? null : blankService());
  const [formError, setFormError] = useState("");

  const commit = () => {
    if (!editing) return;
    const price = Number(editing.price);
    const max = Number(editing.maxGuests);
    if (editing.name.trim().length < 3) return setFormError("Give the service a name, e.g. “Hunza valley day tour”.");
    if (!Number.isFinite(price) || price <= 0) return setFormError("Enter a price in rupees.");
    if (!Number.isInteger(max) || max < 1 || max > 50) return setFormError("Group size must be between 1 and 50.");
    const service: GuideService = {
      id: editing.id ?? newGuideId("svc"),
      name: editing.name.trim(),
      // The type was chosen once, on the profile step.
      category: editing.category ?? guide.guideTypes?.[0] ?? "local",
      description: editing.description.trim(),
      durationLabel: editing.durationLabel.trim() || "Full day",
      durationHours: editing.durationHours,
      price,
      pricingType: editing.pricingType,
      currency: "PKR",
      minGuests: 1,
      maxGuests: max,
      included: editing.included,
      excluded: [],
      availableLocations: guide.areasCovered ?? [],
      active: true,
    };
    setServices((list) => (list.some((s) => s.id === service.id) ? list.map((s) => (s.id === service.id ? service : s)) : [...list, service]));
    setEditing(null);
    setFormError("");
  };

  const ideas = nameIdeas(guide, services.map((s) => s.name));
  const dailyRate = Number(daily) > 0 ? Number(daily) : undefined;
  const patch: Partial<GuideDetails> = { services, dailyHireRate: dailyRate };

  return (
    <>
      <section className={v.section} aria-labelledby="g-svc">
        <Head n={1} id="g-svc" title="What travellers can book" sub="Each service shows on your profile with its price" />
        {services.map((s) => (
          <div key={s.id} className={g.serviceCard}>
            <span className={g.serviceIcon}>
              <Compass size={18} />
            </span>
            <span className={g.serviceText}>
              <strong>{s.name}</strong>
              <span>
                {[s.durationLabel, `up to ${s.maxGuests} guests`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className={g.price}>
              {rupees(s.price)} <small style={{ fontWeight: 400, fontSize: 11 }}>{PRICING_SHORT[s.pricingType]}</small>
            </span>
            <span className={g.cardActions}>
              <button type="button" className={g.remove} aria-label={`Edit ${s.name}`} onClick={() => setEditing({ ...s, price: String(s.price), maxGuests: String(s.maxGuests) })}>
                <Pencil size={15} />
              </button>
              <button type="button" className={g.remove} aria-label={`Remove ${s.name}`} onClick={() => setServices((l) => l.filter((x) => x.id !== s.id))}>
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}

        {editing ? (
          <div className={g.editor}>
            <h3 className={g.editorTitle}>{editing.id ? "Edit service" : services.length ? "Add another service" : "Your first service"}</h3>
            {formError ? <span className={v.fieldError}>{formError}</span> : null}
            <AuthField label="Name *" icon={Compass} placeholder="e.g. Hunza day tour" value={editing.name} onChange={(e) => { setFormError(""); setEditing({ ...editing, name: e.target.value }); }} />
            {ideas.length && !editing.name.trim() ? (
              <div className={styles.field}>
                <span className={v.choiceLabel}>Ideas from your profile — tap one</span>
                <div className={v.chips}>
                  {ideas.map((idea) => (
                    <button key={idea} type="button" className={v.chip} onClick={() => { setFormError(""); setEditing({ ...editing, name: idea }); }}>
                      <Plus size={13} /> {idea}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.field}>
              <span className={v.choiceLabel}>How long?</span>
              <div className={v.chips}>
                {DURATIONS.map((d) => (
                  <button key={d.label} type="button" aria-pressed={editing.durationLabel === d.label} className={`${v.chip} ${editing.durationLabel === d.label ? v.chipOn : ""}`} onClick={() => setEditing({ ...editing, durationLabel: d.label, durationHours: d.hours })}>
                    <Clock3 size={13} /> {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <span className={v.choiceLabel}>How do you charge?</span>
              <div className={v.options} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {PRICING.map((p) => {
                  const on = editing.pricingType === p.value;
                  return (
                    <button key={p.value} type="button" role="radio" aria-checked={on} className={`${v.option} ${on ? v.optionOn : ""}`} onClick={() => setEditing({ ...editing, pricingType: p.value })}>
                      <span className={v.radio} aria-hidden="true" />
                      <span>
                        <strong>{p.label}</strong>
                        <span>{p.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.row2}>
              <AuthField label={`Price (Rs) — ${PRICING_SHORT[editing.pricingType]} *`} icon={Wallet} inputMode="numeric" placeholder="e.g. 6000" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^\d]/g, "") })} />
              <AuthField label="Max group size *" icon={Users} inputMode="numeric" value={editing.maxGuests} onChange={(e) => setEditing({ ...editing, maxGuests: e.target.value.replace(/[^\d]/g, "") })} />
            </div>
            <TextArea label="What will travellers do? (optional)" value={editing.description} onChange={(value) => setEditing({ ...editing, description: value })} max={600} placeholder="Walk through Altit village, visit Altit Fort, lunch with a local family…" />
            <TagInput label="Included (optional)" icon={BadgeCheck} values={editing.included} onChange={(included) => setEditing({ ...editing, included })} placeholder="Type your own and press Enter" />
            <div className={v.chips} role="group" aria-label="Common inclusions">
              {INCLUDED_IDEAS.filter((idea) => !editing.included.includes(idea)).map((idea) => (
                <button key={idea} type="button" className={v.chip} onClick={() => setEditing({ ...editing, included: [...editing.included, idea] })}>
                  <Plus size={13} /> {idea}
                </button>
              ))}
            </div>
            <p className={v.draftNote}>
              <MapPin size={13} /> The meeting place is agreed with each traveller in chat after they book.
            </p>
            <div className={g.editorActions}>
              {services.length || editing.id ? (
                <button type="button" className={styles.secondary} onClick={() => { setEditing(null); setFormError(""); }}>
                  Cancel
                </button>
              ) : (
                <span />
              )}
              <button type="button" className={styles.primary} style={{ marginTop: 0 }} onClick={commit}>
                {editing.id ? "Update service" : "Add service"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={g.addButton} onClick={() => setEditing(blankService())}>
            <Plus size={15} /> Add {services.length ? "another" : "a"} service
          </button>
        )}
      </section>

      <div className={g.or}>or</div>

      <section className={v.section} aria-labelledby="g-daily">
        <Head n={2} id="g-daily" title="Daily hire rate" sub="Optional: travellers hire you for a full day and plan it with you" />
        <div style={{ maxWidth: 280 }}>
          <AuthField label="Rate per day (Rs)" icon={Wallet} inputMode="numeric" placeholder="e.g. 8000" value={daily} onChange={(e) => setDaily(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
      </section>

      <SaveButton
        busy={busy || Boolean(editing && editing.name.trim())}
        saving={saving}
        uploading={uploading}
        label={editing && editing.name.trim() ? "Add or cancel the service above first" : undefined}
        onClick={() => void save(patch, servicesMissing({ ...guide, ...patch }))}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 · Availability                                               */
/* ------------------------------------------------------------------ */

function ScheduleStep({ guide, busy, saving, uploading, save }: StepProps) {
  const [week, setWeek] = useState<GuideDay[]>(guide.availability?.weekly ?? []);
  const [notice, setNotice] = useState(guide.availability?.advanceBookingHours ?? 24);
  const [blocked, setBlocked] = useState<string[]>(guide.availability?.blockedDates ?? []);
  const [date, setDate] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [dayError, setDayError] = useState("");

  const setDay = (day: string, patch: Partial<GuideDay>) => setWeek((w) => w.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const preset = (days: string[]) => setWeek((w) => w.map((d) => ({ ...d, enabled: days.includes(d.day) })));

  const onSave = () => {
    const bad = week.find((d) => d.enabled && d.endTime <= d.startTime);
    if (bad) {
      setDayError(`${WEEKDAYS.find((w) => w.day === bad.day)?.label}: the end time must be after the start time.`);
      return;
    }
    setDayError("");
    const patch: Partial<GuideDetails> = { availability: { weekly: week, advanceBookingHours: notice, blockedDates: blocked } };
    void save(patch, scheduleMissing({ ...guide, ...patch }));
  };

  return (
    <>
      <section className={v.section} aria-labelledby="g-week">
        <Head n={1} id="g-week" title="Your week" sub="Turn on the days you can guide and set your hours" />
        <div className={g.quick}>
          <button type="button" className={v.chip} onClick={() => preset(WEEKDAYS.map((w) => w.day))}>Every day</button>
          <button type="button" className={v.chip} onClick={() => preset(["monday", "tuesday", "wednesday", "thursday", "friday"])}>Weekdays</button>
          <button type="button" className={v.chip} onClick={() => preset(["saturday", "sunday"])}>Weekends</button>
        </div>
        {dayError ? <span className={v.fieldError}>{dayError}</span> : null}
        <div className={g.week}>
          {week.map((d) => {
            const label = WEEKDAYS.find((w) => w.day === d.day)?.label ?? d.day;
            return (
              <div key={d.day} className={`${g.dayRow} ${d.enabled ? "" : g.dayOff}`}>
                <button type="button" className={g.dayToggle} role="switch" aria-checked={d.enabled} onClick={() => setDay(d.day, { enabled: !d.enabled })}>
                  <span className={`${g.switch} ${d.enabled ? g.switchOn : ""}`} aria-hidden="true" />
                  {label}
                </button>
                {d.enabled ? (
                  <span className={g.times}>
                    <input type="time" className={g.time} aria-label={`${label} start`} value={d.startTime} onChange={(e) => setDay(d.day, { startTime: e.target.value })} />
                    to
                    <input type="time" className={g.time} aria-label={`${label} end`} value={d.endTime} onChange={(e) => setDay(d.day, { endTime: e.target.value })} />
                  </span>
                ) : (
                  <span className={g.closed}>Not available</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-notice">
        <Head n={2} id="g-notice" title="Booking notice" sub="How far ahead must travellers book you?" />
        <div className={v.chips} role="radiogroup" aria-label="Booking notice">
          {NOTICE.map((n) => (
            <button key={n.hours} type="button" role="radio" aria-checked={notice === n.hours} className={`${v.chip} ${notice === n.hours ? v.chipOn : ""}`} onClick={() => setNotice(n.hours)}>
              {n.label}
            </button>
          ))}
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-off">
        <Head n={3} id="g-off" title="Days off (optional)" sub="Dates you already know you can’t guide" />
        <div className={g.addRow}>
          <AuthField label="Date" icon={CalendarX} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className={g.addButton} style={{ alignSelf: "end" }} disabled={!date || blocked.includes(date)} onClick={() => { setBlocked((b) => [...b, date].sort()); setDate(""); }}>
            <Plus size={15} /> Block
          </button>
        </div>
        {blocked.length ? (
          <div className={v.chips}>
            {blocked.map((d) => (
              <span key={d} className={g.tag}>
                {new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                <button type="button" aria-label={`Unblock ${d}`} onClick={() => setBlocked((b) => b.filter((x) => x !== d))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={onSave} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 7 · Photos & documents                                         */
/* ------------------------------------------------------------------ */

const MAX_PHOTOS = 12;

function PhotosStep({ guide, busy, saving, uploading, trackUpload, save }: StepProps) {
  const [photos, setPhotos] = useState(guide.photos ?? []);
  const [slot, setSlot] = useState(0);
  const [docs, setDocs] = useState(() =>
    DOCS.map((d) => {
      const saved = guide.documents?.find((x) => x.type === d.type);
      return { type: d.type, id: saved?.id ?? newGuideId("doc"), number: saved?.number ?? "", fileUrl: saved?.fileUrl ?? "", status: saved?.status ?? ("pending" as const) };
    }),
  );
  const setDoc = (type: GuideDocumentType, patch: Partial<(typeof docs)[number]>) => setDocs((list) => list.map((d) => (d.type === type ? { ...d, ...patch } : d)));

  const otherDocs = (guide.documents ?? []).filter((d) => !DOCS.some((x) => x.type === d.type));
  const patch: Partial<GuideDetails> = {
    photos,
    documents: [...otherDocs, ...docs.filter((d) => d.fileUrl).map((d) => ({ ...d, number: d.number.trim() || undefined }))],
  };

  return (
    <>
      <section className={v.section} aria-labelledby="g-gallery">
        <Head n={1} id="g-gallery" title="Trip photos (optional)" sub={`Up to ${MAX_PHOTOS}: views, groups you’ve guided, you on the trail`} />
        <div className={g.gallery}>
          {photos.map((p) => (
            <div key={p.id} className={g.tile}>
              <img src={p.url} alt={p.caption || "Trip photo"} />
              <button type="button" className={g.tileRemove} aria-label="Remove photo" onClick={() => setPhotos((l) => l.filter((x) => x.id !== p.id))}>
                <X size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <PhotoUpload
              key={slot}
              label={photos.length ? "Add another" : "Add a photo"}
              folder="guides"
              onBusyChange={trackUpload}
              onChange={(url) => {
                if (!url) return;
                setPhotos((l) => [...l, { id: newGuideId("photo"), url, category: "destinations" }]);
                setSlot((n) => n + 1);
              }}
            />
          ) : null}
        </div>
      </section>

      <section className={v.section} aria-labelledby="g-docs">
        <Head n={2} id="g-docs" title="Licences & certificates (optional)" sub="Only the BANJARA team sees these. Verified guides get a badge." />
        <div className={g.docGrid}>
          {DOCS.map((d) => {
            const doc = docs.find((x) => x.type === d.type)!;
            return (
              <div key={d.type} className={g.doc}>
                <strong>{d.label}</strong>
                <PhotoUpload label="Photo of the document" hint={d.hint} folder="guides" value={doc.fileUrl} onChange={(url) => setDoc(d.type, { fileUrl: url })} onBusyChange={trackUpload} />
                <AuthField label="Number (optional)" icon={Award} value={doc.number} onChange={(e) => setDoc(d.type, { number: e.target.value })} />
              </div>
            );
          })}
        </div>
      </section>

      <SaveButton busy={busy} saving={saving} uploading={uploading} onClick={() => void save(patch, [])} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 8 · Review                                                     */
/* ------------------------------------------------------------------ */

function ReviewStep({ guide, busy, saving, save, ownerName, city }: StepProps & { ownerName: string; city: string }) {
  const missing = [...profileMissing(guide), ...servicesMissing(guide), ...scheduleMissing(guide)];
  const status = guide.profileStatus;
  const submitted = status === "pending" || status === "approved";
  const days = (guide.availability?.weekly ?? []).filter((d) => d.enabled);
  const docs = (guide.documents ?? []).filter((d) => d.fileUrl);

  return (
    <>
      {status === "approved" ? (
        <div className={g.status}>
          <BadgeCheck size={20} />
          <div>
            <strong>Your guide profile is approved</strong>
            <p>Travellers can find and book you. Changes you save here go live after a quick check.</p>
          </div>
        </div>
      ) : submitted ? (
        <div className={g.status}>
          <Send size={20} />
          <div>
            <strong>Submitted — we’re reviewing your profile</strong>
            <p>We’ll let you know within 1–2 working days. You can still improve your profile below.</p>
          </div>
        </div>
      ) : status === "changes_requested" ? (
        <div className={`${g.status} ${g.statusWarn}`}>
          <Pencil size={20} />
          <div>
            <strong>BANJARA asked for a few changes</strong>
            <p>{guide.changesRequestedNote || "Update your profile, then submit it again."}</p>
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

      <ReviewCard step="profile" title="Guide profile">
        {guide.profilePhoto ? <img src={guide.profilePhoto} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} /> : null}
        <Line label="Name" value={guide.fullName || ownerName} />
        <Line label="Based in" value={guide.city || city} />
        <Line label="Guide types" value={(guide.guideTypes ?? []).map((t) => TYPE_LABEL[t] ?? t).join(", ")} />
        <Line label="Areas" value={(guide.areasCovered ?? []).join(", ")} />
        <Line label="Languages" value={(guide.languages ?? []).map((l) => `${l.language} (${LEVELS.find((x) => x.value === l.proficiency)?.label ?? l.proficiency})`).join(", ")} />
        <Line label="Bio" value={guide.shortBio} />
      </ReviewCard>

      <ReviewCard step="services" title="Services & prices">
        {(guide.services ?? []).map((s) => (
          <Line key={s.id} label={s.name} value={`${rupees(s.price)} ${PRICING_SHORT[s.pricingType]} · ${s.durationLabel}`} />
        ))}
        {guide.dailyHireRate ? <Line label="Daily hire" value={`${rupees(guide.dailyHireRate)} per day`} /> : null}
      </ReviewCard>

      <ReviewCard step="schedule" title="Availability">
        <Line label="Days" value={days.map((d) => `${WEEKDAYS.find((w) => w.day === d.day)?.label.slice(0, 3)} ${d.startTime}–${d.endTime}`).join(" · ")} />
        <Line label="Booking notice" value={NOTICE.find((n) => n.hours === guide.availability?.advanceBookingHours)?.label ?? "1 day"} />
        {guide.availability?.blockedDates.length ? <Line label="Days off" value={`${guide.availability.blockedDates.length} date(s)`} /> : null}
      </ReviewCard>

      <ReviewCard step="photos" title="Photos & documents">
        <Line label="Trip photos" value={guide.photos?.length ? `${guide.photos.length} photo(s)` : "None yet"} />
        <Line label="Documents" value={docs.length ? docs.map((d) => DOCS.find((x) => x.type === d.type)?.label ?? d.type).join(", ") : "None yet"} />
      </ReviewCard>

      <p className={v.draftNote}>
        <BadgeCheck size={13} /> CNIC checks with NADRA are coming soon — our team checks your CNIC during review.
      </p>

      {submitted ? (
        <Link href="/provider" className={styles.primary}>
          Go to your dashboard <ArrowRight size={16} />
        </Link>
      ) : (
        <button type="button" className={styles.primary} disabled={busy || missing.length > 0} onClick={() => void save({}, missing, true)}>
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          {saving ? "Submitting…" : status === "changes_requested" ? "Submit again" : "Submit for review"}
        </button>
      )}
    </>
  );
}

function ReviewCard({ step, title, children }: { step: GuideStep; title: string; children: ReactNode }) {
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
