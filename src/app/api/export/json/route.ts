import { NextResponse } from "next/server";
import { exportUserData } from "@/server/export";
import { withUser } from "@/server/api";

/** JSON export of the signed-in user's data (§68). */
export async function GET() {
  return withUser(
    async (user) => {
      const data = await exportUserData(user.id);
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="brewcore-export-${new Date().toISOString().slice(0, 10)}.json"`,
          "Cache-Control": "no-store",
        },
      });
    },
    { limit: "export" },
  );
}
