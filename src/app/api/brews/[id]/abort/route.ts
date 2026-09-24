import { NextResponse } from "next/server";
import { z } from "zod";
import { abortBrew } from "@/server/brews";
import { noStore, readJson, withUser } from "@/server/api";

const abortInput = z.object({ abortedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)) });

/** Idempotent abort, queued like a completion when offline (§58). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUser(
    async (user) => {
      const { abortedAt } = abortInput.parse(await readJson(request));
      const result = await abortBrew(user.id, id, abortedAt);
      return NextResponse.json({ result }, { headers: noStore });
    },
    { mutation: true, limit: "brewSync" },
  );
}
