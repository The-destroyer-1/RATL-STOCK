import { NextResponse } from "next/server";
import { subscribeVehicles } from "@/lib/vehicle-store";

export async function GET() {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = (payload: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      };
      const unsubscribe = subscribeVehicles(subscriber);

      controller.enqueue(new TextEncoder().encode("data: {\"vehicles\": []}\n\n"));

      return () => {
        unsubscribe();
      };
    },
    cancel() {
      // Called when the client disconnects.
      // The subscriber unregisters automatically from start's return.
    },
  });

  return new NextResponse(stream, { headers });
}
