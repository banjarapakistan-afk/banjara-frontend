"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fuel, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { classLabel, formatRupees } from "@/lib/intercity";
import { useQuery } from "@/lib/live-query";
import {
  getDriverPricing,
  saveVehiclePricing,
  type DriverPricing,
  type FuelType,
  type VehicleCostInput,
  type VehiclePricing,
} from "@/services/customer/intercity.service";
import s from "../sections/sections.module.css";
import c from "./intercity.module.css";

const PRICING_KEY = ["provider", "intercity-pricing"];

type NumberField = "kmPerLitre" | "maintenance" | "labour" | "insurance" | "vipCharge" | "saverPercent" | "premiumPercent";

const FIELDS: Array<{ key: NumberField; label: string; unit: string; step: number }> = [
  { key: "kmPerLitre", label: "Mileage", unit: "km per litre", step: 0.5 },
  { key: "maintenance", label: "Car maintenance", unit: "Rs per trip", step: 100 },
  { key: "labour", label: "Driver", unit: "Rs per trip", step: 100 },
  { key: "insurance", label: "Insurance", unit: "Rs per trip", step: 100 },
  { key: "vipCharge", label: "VIP service", unit: "Rs, when asked", step: 100 },
  { key: "saverPercent", label: "Saver price", unit: "% below standard", step: 1 },
  { key: "premiumPercent", label: "Premium price", unit: "% above standard", step: 1 },
];

/**
 * Provider area → City to City → "Your trip costs": the driver's running costs per vehicle.
 * Fares are worked out from these (fuel for the trip and the drive to the pickup, plus
 * maintenance, driver and insurance per trip). Empty fields use BANJARA's defaults.
 */
export function VehiclePricingCard() {
  const pricing = useQuery({ queryKey: PRICING_KEY, queryFn: getDriverPricing });
  if (pricing.isPending) return null;
  if (pricing.isError) {
    return (
      <section className={s.card}>
        <p className={s.error}>{pricing.error.message}</p>
      </section>
    );
  }
  if (pricing.data.pricingMode !== "cost") return null;

  return (
    <section className={s.card} aria-labelledby="ic-pricing">
      <h3 id="ic-pricing" className={s.cardTitle}>
        Your trip costs
      </h3>
      <p className={c.muted}>
        <Fuel size={14} />
        <span>
          Your prices are worked out from these: fuel for the trip and your drive to the pickup (petrol{" "}
          {formatRupees(pricing.data.fuelPrices.petrol)}/l, diesel {formatRupees(pricing.data.fuelPrices.diesel)}/l), plus
          maintenance, driver and insurance once per trip, plus BANJARA’s app fee of{" "}
          {formatRupees(pricing.data.appFeePerPassenger)} per passenger. Leave a box empty to use BANJARA’s default.
        </span>
      </p>
      {pricing.data.vehicles.length ? (
        <ul className={c.cards}>
          {pricing.data.vehicles.map((vehicle) => (
            <VehicleCostForm key={vehicle.id} vehicle={vehicle} settings={pricing.data} />
          ))}
        </ul>
      ) : (
        <p className={c.muted}>Add a car, SUV, jeep, van or coaster to set its costs.</p>
      )}
    </section>
  );
}

function initialValues(vehicle: VehiclePricing) {
  const values = {} as Record<NumberField, string>;
  for (const { key } of FIELDS) values[key] = vehicle.own[key] != null ? String(vehicle.own[key]) : "";
  return values;
}

function VehicleCostForm({ vehicle, settings }: { vehicle: VehiclePricing; settings: DriverPricing }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => initialValues(vehicle));
  const [fuelType, setFuelType] = useState<FuelType | "">(vehicle.own.fuelType ?? "");
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async (input: VehicleCostInput, mode: "save" | "reset") => {
    setError("");
    setSaved(false);
    setBusy(mode);
    try {
      const updated = await saveVehiclePricing(vehicle.id, input);
      queryClient.setQueryData<DriverPricing>(PRICING_KEY, (old) =>
        old ? { ...old, vehicles: old.vehicles.map((v) => (v.id === updated.id ? updated : v)) } : old,
      );
      setValues(initialValues(updated));
      setFuelType(updated.own.fuelType ?? "");
      setSaved(true);
      // Open requests show prices from these costs.
      await queryClient.invalidateQueries({ queryKey: ["provider", "intercity-requests"] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t save your costs.");
    } finally {
      setBusy(null);
    }
  };

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    const input: VehicleCostInput = { fuelType: fuelType || null };
    for (const { key, label } of FIELDS) {
      const raw = values[key].trim();
      if (!raw) {
        input[key] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return setError(`${label}: enter a number, or leave it empty.`);
      if ((key === "saverPercent" || key === "premiumPercent") && value > settings.maxLevelPercent)
        return setError(`${label} can be at most ${settings.maxLevelPercent}%.`);
      if (key === "kmPerLitre" && (value < 1 || value > 60)) return setError("Mileage must be between 1 and 60 km per litre.");
      input[key] = value;
    }
    void submit(input, "save");
  };

  const reset = () => {
    const input: VehicleCostInput = { fuelType: null };
    for (const { key } of FIELDS) input[key] = null;
    void submit(input, "reset");
  };

  const example = vehicle.example;
  return (
    <li className={c.cardItem}>
      <form onSubmit={onSave} className={c.cards}>
        <div className={c.cardTop}>
          <div>
            <strong className={c.route}>{vehicle.name}</strong>
            <span className={c.areas}>
              {classLabel(vehicle.class)} · {vehicle.seats} seats
              {vehicle.custom ? " · your own costs" : " · BANJARA defaults"}
            </span>
          </div>
          <div className={c.fare}>
            <strong>{formatRupees(example.levels.standard)}</strong>
            <span>
              {example.distanceKm} km trip, {example.passengers} passengers
            </span>
          </div>
        </div>

        <div className={c.costGrid}>
          <label>
            Fuel
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType | "")}>
              <option value="">Default ({vehicle.defaults.fuelType})</option>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
            </select>
          </label>
          {FIELDS.map(({ key, label, unit, step }) => (
            <label key={key}>
              <span>
                {label} <small>{unit}</small>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                placeholder={String(vehicle.defaults[key])}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <p className={c.muted}>
          Example, {example.distanceKm} km with {example.pickupKm} km to the pickup: Saver {formatRupees(example.levels.saver)} ·
          Standard {formatRupees(example.levels.standard)} · Premium {formatRupees(example.levels.premium)}
        </p>
        {error ? (
          <p className={s.error} role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className={c.sent} role="status">
            Saved. New and open requests use these costs.
          </p>
        ) : null}
        <div className={c.actions}>
          {vehicle.custom ? (
            <button type="button" className={s.secondary} onClick={reset} disabled={Boolean(busy)}>
              {busy === "reset" ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />} Use defaults
            </button>
          ) : null}
          <button type="submit" className={s.primary} disabled={Boolean(busy)}>
            {busy === "save" ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save costs
          </button>
        </div>
      </form>
    </li>
  );
}
