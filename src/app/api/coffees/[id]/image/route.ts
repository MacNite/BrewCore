import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { getCoffeeImage } from "@/server/coffees";

/** The bag photo, only for its owner (§45, §65). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const image = await getCoffeeImage(user.id, id);
  if (!image?.imageData || !image.imageMime) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(image.imageData), {
    headers: {
      "Content-Type": image.imageMime,
      // Private: the URL carries the update time, so a changed photo is a new URL.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
