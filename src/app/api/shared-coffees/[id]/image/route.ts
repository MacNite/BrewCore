import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { getSharedCoffeeImage } from "@/server/shared-coffees";

const headers = (mime: string) => ({
  "Content-Type": mime,
  // Private: the URL carries the update time, so a changed photo is a new URL.
  "Cache-Control": "private, max-age=86400",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
});

/** A shared coffee's photo, for every signed-in member of the instance (§7, §65). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const image = await getSharedCoffeeImage(id);
  if (!image?.imageData || !image.imageMime) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(image.imageData), { headers: headers(image.imageMime) });
}
