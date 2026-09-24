/**
 * Development/demo seed (§82). NEVER run against a real deployment: it creates
 * a demo account with example coffees. Clearly marked as example data.
 *
 *   SEED_PASSWORD=... npm run db:seed:demo
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { seedCatalogue } from "./seed-catalogue";

const DEMO_EMAIL = "demo@brewcore.invalid";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("The demo seed never runs in production.");
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_PASSWORD (at least 10 characters) to seed the demo account.");

  const prisma = new PrismaClient();
  try {
    await seedCatalogue(prisma);

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {},
      create: {
        email: DEMO_EMAIL,
        username: "demo",
        passwordHash: await hashPassword(password),
        role: "USER",
        profile: { create: { displayName: "Demo (example data)", language: "en", onboardedAt: new Date() } },
      },
    });

    const roaster = await prisma.roaster.upsert({
      where: { id: `demo-roaster-${user.id}` },
      update: {},
      create: { id: `demo-roaster-${user.id}`, ownerId: user.id, name: "Example Roastery", country: "Germany", notes: "Example data" },
    });

    const coffees = [
      { name: "Ethiopia Guji Natural", country: "Ethiopia", region: "Guji", process: "Natural", roastLevel: "LIGHT" as const, notes: ["blueberry", "jasmine"] },
      { name: "Kenya Nyeri Washed", country: "Kenya", region: "Nyeri", process: "Washed", roastLevel: "LIGHT" as const, notes: ["blackcurrant", "grapefruit"] },
      { name: "Brazil Fazenda Natural", country: "Brazil", region: "Minas Gerais", process: "Natural", roastLevel: "MEDIUM" as const, notes: ["chocolate", "hazelnut"] },
    ];
    for (const [index, coffee] of coffees.entries()) {
      const id = `demo-coffee-${index}-${user.id}`;
      await prisma.coffee.upsert({
        where: { id },
        update: {},
        create: {
          id,
          ownerId: user.id,
          name: coffee.name,
          roasterId: roaster.id,
          roasterNameSnapshot: roaster.name,
          country: coffee.country,
          region: coffee.region,
          process: coffee.process,
          roastLevel: coffee.roastLevel,
          roastDate: new Date(Date.now() - (10 + index * 5) * 86_400_000),
          bagWeightG: 250,
          remainingWeightG: 250 - index * 60,
          roasterTastingNotes: coffee.notes,
          userTags: ["example"],
          notes: "Example data from the demo seed.",
        },
      });
    }

    const comandante = await prisma.grinderModel.findUniqueOrThrow({ where: { slug: "comandante-c40-mk4" } });
    const grinderId = `demo-grinder-${user.id}`;
    await prisma.userGrinder.upsert({
      where: { id: grinderId },
      update: {},
      create: { id: grinderId, ownerId: user.id, grinderModelId: comandante.id, nickname: "Demo Comandante", defaultForFilter: true },
    });

    console.log(`Demo account ready: ${DEMO_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
