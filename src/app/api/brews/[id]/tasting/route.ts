import { NextResponse } from "next/server";
import { saveTasting, tastingInput } from "@/server/brews";
import { noStore, readJson, withUser } from "@/server/api";

/** The quick post-brew tasting, queued behind the completion when offline (§57). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUser(
    async (user) => {
      const input = tastingInput.parse(await readJson(request));
      await saveTasting(user.id, id, input);
      return NextResponse.json({ result: "saved" }, { headers: noStore });
    },
    { mutation: true, limit: "brewSync" },
  );
}
