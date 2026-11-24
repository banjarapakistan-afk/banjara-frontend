"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Car,
  Hash,
  LoaderCircle,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCustomerAuth } from "@/components/providers/customer-auth-provider";
import { useBackendStatus, useQuery } from "@/lib/live-query";
import { DRIVER_STEP_TOTAL, driverStepHref, driverStepNumber, previousStep } from "@/lib/driver-steps";
import { getProviderApplication } from "@/services/customer/auth.service";
import {
  getMyDriverProfile,
  saveDriverVehicle,
  type DriverVehicleDetails,
} from "@/services/customer/provider-application.service";
import { AuthShell } from "./auth-shell";
import { AuthBanner, AuthField } from "./auth-fields";
import { PhotoUpload } from "./photo-upload";
import styles from "./auth.module.css";
import v from "./vehicle.module.css";

const STEP = driverStepNumber("transport");
/** "Your details", returning here after saving. */
const DETAILS_FROM_HERE = "/provider-application?edit=details&return=%2Fprovider-application%2Fvehicle";
const THIS_YEAR = new Date().getFullYear();

const VEHICLE_TYPES = [
  { value: "car", label: "Car" },
  { value: "jeep", label: "Jeep" },
  { value: "suv", label: "SUV" },
  { value: "van", label: "Van" },
  { value: "mini_bus", label: "Mini bus" },
  { value: "bus", label: "Bus" },
] as const;

/** Same insurer list as the app. */
const INSURERS = [
  { value: "jubilee", label: "Jubilee General Insurance" },
  { value: "efu", label: "EFU General Insurance" },
  { value: "adamjee", label: "Adamjee Insurance" },
  { value: "ubl_insurer", label: "UBL Insurers" },
  { value: "askari", label: "Askari General Insurance" },
  { value: "igi", label: "IGI Insurance" },
  { value: "takaful_pakistan", label: "Takaful Pakistan" },
  { value: "salaam_takaful", label: "Salaam Takaful" },
  { value: "other", label: "Other" },
];

const isYear = (value: string) =>
  /^\d{4}$/.test(value.trim()) && Number(value) >= 1980 && Number(value) <= THIS_YEAR + 1;


/* Mirrors the backend checks in utils/transportValidation.ts. */
const schema = z
  .object({
    vehicleClass: z.enum(["car", "jeep", "suv", "van", "mini_bus", "bus"], {
      message: "Choose your vehicle type",
    }),
    vehicleModel: z.string().trim().min(2, "Enter the vehicle model, e.g. Toyota Corolla"),
    vehicleMakeYear: z.string().refine(isYear, `Enter a year from 1980 to ${THIS_YEAR + 1}`),
    registrationNumber: z.string().trim().min(3, "Enter the registration number"),
    engineNumber: z.string().trim().min(3, "Enter the engine number"),
    ownerName: z.string().trim().min(2, "Enter the name on the registration book"),
    driverLicenseNumber: z.string().trim().min(3, "Enter your driving licence number"),
    hasInsurance: z.enum(["yes", "no"], { message: "Tell us if your vehicle is insured" }),
    insuranceCompany: z.string(),
    insuranceNumber: z.string().trim(),
    insuranceYear: z.string(),
    vehicleImageFront: z.string().min(1, "Add a photo of the front of your vehicle"),
    vehicleImageBack: z.string().min(1, "Add a photo of the back of your vehicle"),
    driverPhoto: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.hasInsurance === "no") {
      ctx.addIssue({
        code: "custom",
        path: ["hasInsurance"],
        message: "Valid car insurance is required. Drivers without insurance can’t be approved.",
      });
    }
    if (value.hasInsurance === "yes") {
      if (!value.insuranceCompany)
        ctx.addIssue({ code: "custom", path: ["insuranceCompany"], message: "Choose your insurer" });
      if (value.insuranceNumber.length < 3)
        ctx.addIssue({ code: "custom", path: ["insuranceNumber"], message: "Enter the policy number" });
      if (!isYear(value.insuranceYear))
        ctx.addIssue({ code: "custom", path: ["insuranceYear"], message: "Enter the insurance year" });
    }
  }, {
    // Run these cross-field checks even while other fields are still empty,
    // so every problem shows on the first "Save".
    when: () => true,
  });

type Values = z.infer<typeof schema>;
type Prefill = Awaited<ReturnType<typeof getMyDriverProfile>>;

const draftKey = (userId: string) => `banjara.driver-vehicle.${userId}`;
function readDraft(userId: string): Partial<Values> | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as Partial<Values>) : null;
  } catch {
    return null;
  }
}
function writeDraft(userId: string, values: Partial<Values> | null) {
  try {
    if (values) localStorage.setItem(draftKey(userId), JSON.stringify(values));
    else localStorage.removeItem(draftKey(userId));
  } catch {
    /* drafts are a convenience only */
  }
}

/**
 * Routes, fares and the service description are not part of signup: drivers set them per trip
 * from the dashboard once approved. The backend still needs a pricing method to complete this
 * step, so keep whatever was saved before (app or older web), else start as "negotiable".
 */
function serviceDetailsFrom(prefill: Prefill) {
  const t = prefill.transport;
  const amount = Number(t.priceAmount);
  const method = t.pricingMethod;
  const keepPrice =
    method === "negotiable" ||
    ((method === "per_seat" || method === "per_vehicle") && Number.isFinite(amount) && amount > 0);
  const percent = Number(t.pricePercent);
  return {
    operatingCities: (Array.isArray(t.operatingCities) ? t.operatingCities.map(String) : [prefill.city]).filter(Boolean),
    operatingRoutes: Array.isArray(t.operatingRoutes) ? t.operatingRoutes.map(String) : [],
    description: typeof t.description === "string" && t.description.trim() ? t.description : undefined,
    pricingMethod: (keepPrice ? method : "negotiable") as DriverVehicleDetails["pricingMethod"],
    priceAmount: keepPrice && method !== "negotiable" ? amount : undefined,
    pricePercent:
      t.pricePercent != null && Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : undefined,
  };
}

/** The driver's own facts, saved on "Your details" (step 3). The CNIC comes from the CNIC step. */
function driverFactsFrom(prefill: Prefill) {
  const t = prefill.transport;
  const text = (value: unknown) => (value == null ? "" : String(value).trim());
  return {
    driverName: text(t.driverName) || prefill.ownerName,
    driverPhone: text(t.driverPhone) || prefill.phone,
    driverEmail: text(t.driverEmail) || prefill.email || undefined,
    driverPermanentAddress: text(t.driverPermanentAddress),
    driverEmergencyContact: text(t.driverEmergencyContact),
    driverExperienceYears: text(t.driverExperienceYears) || String(prefill.yearsExperience ?? ""),
    // Keep a CNIC already on file (app or verified card); never asked here.
    driverCnic: text(t.driverCnic) || undefined,
  };
}

const DRIVER_FACTS = [
  ["driverName", "your name"],
  ["driverPhone", "phone"],
  ["driverPermanentAddress", "permanent address"],
  ["driverEmergencyContact", "emergency contact"],
] as const;

function defaultsFrom(prefill: Prefill): Values {
  const t = prefill.transport;
  const text = (value: unknown) => (value == null ? "" : String(value));
  const vehicleClass = VEHICLE_TYPES.some((type) => type.value === t.vehicleClass)
    ? (t.vehicleClass as Values["vehicleClass"])
    : (undefined as unknown as Values["vehicleClass"]);
  return {
    vehicleClass,
    vehicleModel: text(t.vehicleModel),
    vehicleMakeYear: text(t.vehicleMakeYear),
    registrationNumber: text(t.registrationNumber),
    engineNumber: text(t.engineNumber),
    ownerName: text(t.ownerName) || prefill.ownerName,
    driverLicenseNumber: text(t.driverLicenseNumber),
    hasInsurance: (t.hasInsurance === "yes" || t.hasInsurance === "no"
      ? t.hasInsurance
      : undefined) as unknown as Values["hasInsurance"],
    insuranceCompany: text(t.insuranceCompany),
    insuranceNumber: text(t.insuranceNumber),
    insuranceYear: text(t.insuranceYear),
    vehicleImageFront: text(t.vehicleImageFront),
    vehicleImageBack: text(t.vehicleImageBack),
    driverPhoto: text(t.driverPhoto),
  };
}

/** Step 5 for local drivers: the vehicle they drive, their documents, insurance, photos and fares. */
export function DriverVehicle() {
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
  const data = application.data;
  const isDriver = Boolean(data?.services.includes("transport"));
  // Earlier steps come first; a driver who hasn't pinned a location goes back there.
  const earlierHref =
    data?.progress && ["business", "location"].includes(data.progress.nextStep)
      ? driverStepHref(data.progress.nextStep)
      : null;
  useEffect(() => {
    if (!application.isSuccess) return;
    if (!data) router.replace("/provider-application");
    else if (!isDriver) router.replace("/provider");
    else if (earlierHref) router.replace(earlierHref);
  }, [application.isSuccess, data, isDriver, earlierHref, router]);

  const prefill = useQuery({
    queryKey: ["provider", "driver-profile", user?.id],
    queryFn: getMyDriverProfile,
    enabled: isDriver && !earlierHref,
    staleTime: Infinity,
  });

  const caption = `Local driver · Step ${STEP} of ${DRIVER_STEP_TOTAL}`;
  if ((application.isError || prefill.isError) && backend !== "checking") {
    return (
      <AuthShell caption={caption} title="You & your vehicle">
        <AuthBanner>
          {(application.error ?? prefill.error)?.message ||
            "We couldn’t load your application. Check your connection and refresh the page."}
        </AuthBanner>
      </AuthShell>
    );
  }
  if (loading || !isProvider || backend === "checking" || !data || !isDriver || earlierHref || !prefill.data) {
    return (
      <AuthShell caption={caption} title="You & your vehicle">
        <p className={styles.note} role="status">
          <LoaderCircle size={15} className="animate-spin" /> Loading your application…
        </p>
      </AuthShell>
    );
  }
  return <VehicleForm userId={user.id} prefill={prefill.data} />;
}

function VehicleForm({ userId, prefill }: { userId: string; prefill: Prefill }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  // A saved draft (from a refresh) wins over what's on the server, which may be older.
  const defaults = useMemo(() => ({ ...defaultsFrom(prefill), ...(readDraft(userId) ?? {}) }), [prefill, userId]);
  const { register, handleSubmit, formState, watch, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const errors = formState.errors;
  const values = watch();

  // Keep a draft on this device so a refresh doesn't lose a long form.
  const snapshot = JSON.stringify(values);
  useEffect(() => {
    writeDraft(userId, JSON.parse(snapshot) as Partial<Values>);
  }, [snapshot, userId]);

  // Everything about the driver was answered on "Your details"; this step only adds the vehicle.
  const driver = useMemo(() => driverFactsFrom(prefill), [prefill]);
  const missingDriver = DRIVER_FACTS.filter(([key]) => !String(driver[key] ?? "").trim()).map(
    ([, label]) => label,
  );

  const onSubmit = handleSubmit(async (form) => {
    setError("");
    if (missingDriver.length) {
      setError(`Finish “Your details” first: ${missingDriver.join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const details: DriverVehicleDetails = {
      vehicleClass: form.vehicleClass,
      vehicleModel: form.vehicleModel.trim(),
      vehicleMakeYear: form.vehicleMakeYear.trim(),
      registrationNumber: form.registrationNumber.trim().toUpperCase(),
      engineNumber: form.engineNumber.trim().toUpperCase(),
      ownerName: form.ownerName.trim(),
      ...driver,
      driverLicenseNumber: form.driverLicenseNumber.trim().toUpperCase(),
      hasInsurance: "yes",
      insuranceCompany: form.insuranceCompany,
      insuranceNumber: form.insuranceNumber.trim(),
      insuranceYear: form.insuranceYear.trim(),
      vehicleImageFront: form.vehicleImageFront,
      vehicleImageBack: form.vehicleImageBack,
      driverPhoto: form.driverPhoto || undefined,
      ...serviceDetailsFrom(prefill),
    };
    try {
      await saveDriverVehicle(details);
      writeDraft(userId, null);
      const fresh = await queryClient.fetchQuery({
        queryKey: ["provider", "application", userId],
        queryFn: getProviderApplication,
        // Always ask the server: the step just saved changed what comes next.
        staleTime: 0,
      });
      router.replace(driverStepHref(fresh?.progress?.nextStep) ?? "/provider");
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : "We couldn’t save your details. Please try again.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, () => {
    setError("Some details are missing or need a fix. Check the highlighted fields.");
  });

  const busy = formState.isSubmitting || uploading > 0;
  const trackUpload = (on: boolean) => setUploading((count) => Math.max(0, count + (on ? 1 : -1)));

  return (
    <AuthShell
      wide
      caption={`Local driver · Step ${STEP} of ${DRIVER_STEP_TOTAL}`}
      title="You & your vehicle"
      step={{ current: STEP, total: DRIVER_STEP_TOTAL }}
      subtitle="You drive your own vehicle on every ride, so register the one vehicle you drive. Fields marked * are needed for verification."
      previous={previousStep("driver", "transport")}
      backHref="/"
      backLabel="Finish later"
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {error ? <AuthBanner>{error}</AuthBanner> : null}

        {/* 1. Vehicle */}
        <section className={v.section} aria-labelledby="sec-vehicle">
          <Head n={1} id="sec-vehicle" title="Your vehicle" sub="As written in the registration book" />
          <Choice
            label="Vehicle type *"
            error={errors.vehicleClass?.message}
            options={VEHICLE_TYPES}
            value={values.vehicleClass}
            onChange={(value) => setValue("vehicleClass", value as Values["vehicleClass"], { shouldValidate: true })}
          />
          <div className={styles.row2}>
            <AuthField label="Model *" icon={Car} placeholder="e.g. Toyota Corolla" error={errors.vehicleModel?.message} {...register("vehicleModel")} />
            <AuthField label="Make year *" icon={CalendarClock} inputMode="numeric" maxLength={4} placeholder={String(THIS_YEAR - 4)} error={errors.vehicleMakeYear?.message} {...register("vehicleMakeYear")} />
          </div>
          <div className={styles.row2}>
            <AuthField label="Registration number *" icon={Hash} placeholder="e.g. GLT-1234" autoCapitalize="characters" error={errors.registrationNumber?.message} {...register("registrationNumber")} />
            <AuthField label="Engine number *" icon={Hash} autoCapitalize="characters" error={errors.engineNumber?.message} {...register("engineNumber")} />
          </div>
          <AuthField label="Registered in the name of *" icon={UserRound} hint="Usually you. It can be a family member if the vehicle is registered to them." error={errors.ownerName?.message} {...register("ownerName")} />
          <AuthField label="Your driving licence number *" icon={CreditCard} autoCapitalize="characters" placeholder="As on your licence card" error={errors.driverLicenseNumber?.message} {...register("driverLicenseNumber")} />
        </section>

        {/* The driver: answered once on "Your details". Shown here so they know it's covered. */}
        <div className={`${v.driverSummary} ${missingDriver.length ? v.driverSummaryWarn : ""}`}>
          <UserRound size={16} aria-hidden="true" />
          <span>
            <strong>Driver: {driver.driverName || "you"}</strong>
            <span>
              {missingDriver.length
                ? `Missing from Your details: ${missingDriver.join(", ")}`
                : `Emergency ${driver.driverEmergencyContact} · ${driver.driverPermanentAddress}`}
            </span>
          </span>
          <Link href={DETAILS_FROM_HERE} className={v.driverSummaryLink}>
            {missingDriver.length ? "Add now" : "Edit"}
          </Link>
        </div>

        {/* 2. Insurance */}
        <section className={v.section} aria-labelledby="sec-insurance">
          <Head n={2} id="sec-insurance" title="Car insurance" sub="Insurance is required to drive with BANJARA" />
          <Choice
            label="Is your vehicle insured? *"
            error={errors.hasInsurance?.message}
            options={[
              { value: "yes", label: "Yes, it’s insured" },
              { value: "no", label: "No" },
            ]}
            value={values.hasInsurance}
            onChange={(value) => setValue("hasInsurance", value as Values["hasInsurance"], { shouldValidate: true })}
          />
          {values.hasInsurance === "yes" ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="insurer">
                  Insurance company *
                </label>
                <select
                  id="insurer"
                  className={`${v.select} ${errors.insuranceCompany ? v.selectError : ""}`}
                  {...register("insuranceCompany")}
                >
                  <option value="">Choose your insurer</option>
                  {INSURERS.map((insurer) => (
                    <option key={insurer.value} value={insurer.value}>
                      {insurer.label}
                    </option>
                  ))}
                </select>
                {errors.insuranceCompany ? <span className={v.fieldError}>{errors.insuranceCompany.message}</span> : null}
              </div>
              <div className={styles.row2}>
                <AuthField label="Policy number *" icon={ShieldCheck} error={errors.insuranceNumber?.message} {...register("insuranceNumber")} />
                <AuthField label="Insurance year *" icon={CalendarClock} inputMode="numeric" maxLength={4} placeholder={String(THIS_YEAR)} error={errors.insuranceYear?.message} {...register("insuranceYear")} />
              </div>
            </>
          ) : null}
        </section>

        {/* 3. Photos */}
        <section className={v.section} aria-labelledby="sec-photos">
          <Head n={3} id="sec-photos" title="Photos" sub="Clear daylight photos help us verify you faster" />
          <div className={v.photos}>
            <PhotoUpload
              label="Vehicle — front"
              required
              hint="Number plate visible"
              value={values.vehicleImageFront}
              error={errors.vehicleImageFront?.message}
              onBusyChange={trackUpload}
              onChange={(url) => setValue("vehicleImageFront", url, { shouldValidate: true })}
            />
            <PhotoUpload
              label="Vehicle — back"
              required
              hint="Number plate visible"
              value={values.vehicleImageBack}
              error={errors.vehicleImageBack?.message}
              onBusyChange={trackUpload}
              onChange={(url) => setValue("vehicleImageBack", url, { shouldValidate: true })}
            />
            <PhotoUpload
              label="Your photo"
              hint="Travellers see this on your profile"
              value={values.driverPhoto}
              onBusyChange={trackUpload}
              onChange={(url) => setValue("driverPhoto", url)}
            />
          </div>
        </section>

        <p className={v.draftNote}>
          <Route size={13} /> Routes, trips and fares come later: once you’re approved, you add each trip from your dashboard.
        </p>

        <p className={v.draftNote}>
          <BadgeCheck size={13} /> Your answers are kept on this device until you save.
        </p>
        <button type="submit" className={styles.primary} disabled={busy}>
          {formState.isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
          {formState.isSubmitting
            ? "Saving…"
            : uploading
              ? "Waiting for photos to upload…"
              : "Save and continue"}
          {busy ? null : <ArrowRight size={16} />}
        </button>
      </form>
    </AuthShell>
  );
}

function Head({ n, id, title, sub }: { n: number; id: string; title: string; sub: string }) {
  return (
    <div className={v.sectionHead}>
      <span className={v.sectionNumber}>{n}</span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className={styles.field}>
      <span className={v.choiceLabel}>{label}</span>
      <div className={v.chips} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${v.chip} ${on ? v.chipOn : ""}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? <span className={v.fieldError}>{error}</span> : null}
    </div>
  );
}

