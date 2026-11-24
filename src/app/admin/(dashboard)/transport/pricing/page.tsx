"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getPricingSettings,
  savePricingSettings,
  type PricingClassCost,
  type PricingClassKey,
  type PricingSettings,
} from "@/services/admin.service";
import { formatCurrency } from "@/lib/utils";

const SETTINGS_KEY = ["admin", "intercity-pricing"] as const;

const CLASSES: Array<{ key: PricingClassKey; label: string }> = [
  { key: "car", label: "Car" },
  { key: "suv", label: "SUV" },
  { key: "jeep", label: "Jeep" },
  { key: "van", label: "Van / Hiace" },
  { key: "coaster", label: "Coaster" },
];

const FUELS = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
];

const MODES = [
  { value: "cost", label: "Running costs (fuel, driver, maintenance, insurance)" },
  { value: "formula", label: "Old formula (base + per km + per minute)" },
];

/** A standard fare for one class: fuel for the trip, fixed costs once, app fee per passenger. */
function exampleFare(s: PricingSettings, cost: PricingClassCost, km: number, passengers: number) {
  const fuel = (km / Math.max(1, cost.kmPerLitre)) * (s.fuelPrices[cost.fuelType] ?? 0);
  return Math.round((fuel + cost.maintenance + cost.labour + cost.insurance + s.appFeePerPassenger * passengers) / 10) * 10;
}

/**
 * City to City pricing. With running-cost pricing, every fare is worked out from the
 * vehicle's costs: fuel for the trip and the driver's drive to the pickup, plus maintenance,
 * driver and insurance once per trip, plus BANJARA's app fee per passenger. Drivers may set
 * their own costs per vehicle; these are the defaults for anyone who hasn't.
 */
export default function IntercityPricingPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: getPricingSettings });
  const [edits, setDraft] = useState<PricingSettings | null>(null);
  const draft = edits ?? settings.data ?? null;
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (input: PricingSettings) => savePricingSettings(input),
    onSuccess: (data) => {
      setDraft(data);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });

  const header = (
    <PageHeader
      title="City to City pricing"
      description="Fuel prices, BANJARA's app fee and the default running costs that City to City fares are worked out from."
    />
  );

  if (!draft) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-6 text-sm text-muted">
            {settings.isError ? settings.error.message : "Loading pricing…"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const set = (patch: Partial<PricingSettings>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const setClass = (key: PricingClassKey, patch: Partial<PricingClassCost>) =>
    set({ classCosts: { ...draft.classCosts, [key]: { ...draft.classCosts[key], ...patch } } });
  const number = (value: string) => (value === "" ? 0 : Number(value));
  const costMode = draft.pricingMode === "cost";

  return (
    <div className="space-y-6">
      {header}
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(draft);
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>How fares are worked out</CardTitle>
            <CardDescription>
              Standard price = fuel for the trip and the drive to the pickup + maintenance + driver + insurance + tolls
              + VIP (if asked) + app fee × passengers. Each driver answers with their Saver, Standard or Premium price.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1 text-sm font-medium text-navy">
              Pricing
              <Select
                value={draft.pricingMode}
                options={MODES}
                onChange={(e) => set({ pricingMode: e.target.value as PricingSettings["pricingMode"] })}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="space-y-1 text-sm font-medium text-navy">
                Petrol (Rs per litre)
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  value={draft.fuelPrices.petrol}
                  onChange={(e) => set({ fuelPrices: { ...draft.fuelPrices, petrol: number(e.target.value) } })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                Diesel (Rs per litre)
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  value={draft.fuelPrices.diesel}
                  onChange={(e) => set({ fuelPrices: { ...draft.fuelPrices, diesel: number(e.target.value) } })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                App fee (Rs per passenger)
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={draft.appFeePerPassenger}
                  onChange={(e) => set({ appFeePerPassenger: number(e.target.value) })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                VIP charge (Rs, default)
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={draft.vipCharge}
                  onChange={(e) => set({ vipCharge: number(e.target.value) })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                Saver (% below standard)
                <Input
                  type="number"
                  min={0}
                  max={draft.maxLevelPercent}
                  value={draft.saverPercent}
                  onChange={(e) => set({ saverPercent: number(e.target.value) })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                Premium (% above standard)
                <Input
                  type="number"
                  min={0}
                  max={draft.maxLevelPercent}
                  value={draft.premiumPercent}
                  onChange={(e) => set({ premiumPercent: number(e.target.value) })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-navy">
                Most a driver may set (%)
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={draft.maxLevelPercent}
                  onChange={(e) => set({ maxLevelPercent: number(e.target.value) })}
                />
              </label>
            </div>
            <p className="text-sm text-muted">
              The app fee is owed by the driver in full, on top of the commission % on the rest of the fare (set on the
              City to City Commission page). Set the commission to 0 if the app fee should replace it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default costs per vehicle</CardTitle>
            <CardDescription>
              Used for drivers who haven&apos;t set their own costs, and for the estimate riders see before a driver
              answers. Maintenance, driver and insurance are charged once per trip.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">Vehicle</th>
                    <th className="py-2 pr-3 font-medium">Fuel</th>
                    <th className="py-2 pr-3 font-medium">km per litre</th>
                    <th className="py-2 pr-3 font-medium">Maintenance (Rs)</th>
                    <th className="py-2 pr-3 font-medium">Driver (Rs)</th>
                    <th className="py-2 pr-3 font-medium">Insurance (Rs)</th>
                    <th className="py-2 font-medium">600 km, 2 people</th>
                  </tr>
                </thead>
                <tbody>
                  {CLASSES.map(({ key, label }) => {
                    const cost = draft.classCosts[key];
                    return (
                      <tr key={key} className="border-t border-line">
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-navy">
                          {label}
                        </th>
                        <td className="py-2 pr-3">
                          <Select
                            aria-label={`${label} fuel`}
                            value={cost.fuelType}
                            options={FUELS}
                            onChange={(e) => setClass(key, { fuelType: e.target.value as PricingClassCost["fuelType"] })}
                          />
                        </td>
                        {(["kmPerLitre", "maintenance", "labour", "insurance"] as const).map((field) => (
                          <td key={field} className="py-2 pr-3">
                            <Input
                              aria-label={`${label} ${field === "labour" ? "driver" : field === "kmPerLitre" ? "km per litre" : field}`}
                              type="number"
                              min={field === "kmPerLitre" ? 1 : 0}
                              step={field === "kmPerLitre" ? "0.5" : 100}
                              value={cost[field]}
                              onChange={(e) => setClass(key, { [field]: number(e.target.value) })}
                            />
                          </td>
                        ))}
                        <td className="py-2 font-medium text-navy">{formatCurrency(exampleFare(draft, cost, 600, 2))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!costMode ? (
              <p className="mt-3 text-sm text-muted">These apply once pricing is set to running costs.</p>
            ) : null}
          </CardContent>
        </Card>

        {save.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {save.error instanceof Error ? save.error.message : "Pricing could not be saved."}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={save.isPending}>
            Save pricing
          </Button>
          {saved ? <span className="text-sm text-green">Saved. New quotes use these prices.</span> : null}
        </div>
      </form>
    </div>
  );
}
