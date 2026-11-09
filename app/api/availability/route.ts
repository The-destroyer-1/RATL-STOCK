import { NextRequest, NextResponse } from "next/server";
import { buildAvailability } from "@/lib/availability";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const model = url.searchParams.get("model");
  const startOn = url.searchParams.get("startOn");
  const endOn = url.searchParams.get("endOn");

  const availability = buildAvailability(model, startOn, endOn);
  return NextResponse.json(availability);
}
