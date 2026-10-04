import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { getSuggestionImage } from "@/server/suggestions";

/** A photo proposed in a suggestion, for its author and whoever decides on it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const image = await getSuggestionImage(user, id);
  if (!image?.imageData || !image.imageMime) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(image.imageData), {
    headers: {
      "Content-Type": image.imageMime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
