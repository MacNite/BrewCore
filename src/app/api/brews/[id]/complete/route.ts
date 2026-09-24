import { NextResponse } from "next/server";
import { completeBrew, completionInput } from "@/server/brews";
import { noStore, readJson, withUser } from "@/server/api";

/** Idempotent completion, called by the offline outbox (§57). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUser(
    async (user) => {
      const input = completionInput.parse(await readJson(request));
      const result = await completeBrew(user.id, id, input);
      return NextResponse.json({ result }, { headers: noStore });
    },
    { mutation: true, limit: "brewSync" },
  );
}
