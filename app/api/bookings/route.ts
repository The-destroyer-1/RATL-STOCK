import { NextResponse } from "next/server";
import { createBooking, listBookings, deleteBooking, isVehicleBookedInRange } from "@/lib/bookings";
import { buildAvailability } from "@/lib/availability";
import { publishUpdate } from "@/lib/vehicle-store";

export async function GET() {
  return NextResponse.json({ bookings: listBookings() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { vehicleId, model, plate, name, email, startOn, endOn } = body;
  if (!vehicleId || !startOn || !endOn || !name || !email) {
    return NextResponse.json({ error: "Invalid booking payload" }, { status: 400 });
  }

  // check overlapping bookings for the same vehicle
  if (isVehicleBookedInRange(vehicleId, startOn, endOn)) {
    return NextResponse.json({ error: "Vehicle already booked for the selected dates" }, { status: 409 });
  }

  // check fleet-level availability for the model
  const availability = buildAvailability(model ?? null, startOn, endOn);
  if (!availability.available || availability.remaining <= 0) {
    return NextResponse.json({ error: "No vehicles of this model are available for the selected dates" }, { status: 409 });
  }

  const booking = createBooking({ vehicleId, model, plate, name, email, startOn, endOn });
  // notify subscribers so availability updates
  try {
    publishUpdate();
  } catch {}
  return NextResponse.json({ booking }, { status: 201 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const removed = deleteBooking(id);
  if (!removed) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  try {
    publishUpdate();
  } catch {}
  return NextResponse.json({ removed });
}
