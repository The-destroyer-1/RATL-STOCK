import { NextResponse } from "next/server";
import { getVehicleList, updateVehicleAvailability, createVehicle, deleteVehicle } from "@/lib/vehicle-store";

export async function GET() {
  return NextResponse.json({ vehicles: getVehicleList() });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : null;
  const available = typeof body.available === "boolean" ? body.available : null;

  if (!id || available === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const vehicle = updateVehicleAvailability(id, available);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({ vehicle });
}

export async function POST(request: Request) {
  const body = await request.json();
  const model = typeof body.model === "string" ? body.model : null;
  const plate = typeof body.plate === "string" ? body.plate : null;
  const wallet = typeof body.wallet === "number" ? body.wallet : 0;

  if (!model || !plate) {
    return NextResponse.json({ error: "Invalid vehicle payload" }, { status: 400 });
  }

  const vehicle = createVehicle({ model, plate, wallet });
  return NextResponse.json({ vehicle }, { status: 201 });
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const removed = deleteVehicle(id);
    if (!removed) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ removed }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/vehicles error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
