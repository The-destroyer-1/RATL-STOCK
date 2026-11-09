import { NextResponse } from "next/server";
import { subscribeVehicles } from "@/lib/vehicle-store";

export async function GET() {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let unsubscribe: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const subscriber = (payload: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      };
      unsubscribe = subscribeVehicles(subscriber);
      controller.enqueue(new TextEncoder().encode('data: {"vehicles": []}\n\n'));
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
  });

  return new NextResponse(stream, { headers });
}
