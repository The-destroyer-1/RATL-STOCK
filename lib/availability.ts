import { getVehicleList } from "@/lib/vehicle-store";
import { isVehicleBookedInRange } from "@/lib/bookings";

export type Availability = {
  available: boolean;
  remaining: number;
  nextAvailableDate: string;
  message: string;
  updatedAt: string;
};

export function buildAvailability(model: string | null, startOn: string | null, endOn: string | null): Availability {
  const now = new Date();
  const updatedAt = now.toISOString();

  if (!model || !startOn || !endOn) {
    return {
      available: false,
      remaining: 0,
      nextAvailableDate: "TBD",
      message: "Select a car and dates to check realtime availability.",
      updatedAt,
    };
  }

  const startDate = new Date(startOn);
  const endDate = new Date(endOn);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    return {
      available: false,
      remaining: 0,
      nextAvailableDate: "TBD",
      message: "Enter a valid date range to see availability.",
      updatedAt,
    };
  }

  // derive fleet count from vehicle-store, excluding vehicles already unavailable
  const fleet = getVehicleList();
  const candidates = fleet.filter((v) => v.model === model && v.available);

  // subtract any vehicle that has an overlapping booking for the requested range
  const remaining = candidates.filter((v) => !isVehicleBookedInRange(v.id, startOn, endOn)).length;

  return {
    available: remaining > 0,
    remaining,
    nextAvailableDate: remaining > 0 ? startDate.toLocaleDateString() : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3).toLocaleDateString(),
    message: remaining > 0 ? `Good news — ${remaining} ${model} vehicle(s) are available for your dates.` : `No ${model} vehicles are available for the selected dates. Check again soon.`,
    updatedAt,
  };
}
