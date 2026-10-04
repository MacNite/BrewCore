-- Coffee sharing (§7, §8): every coffee and roaster becomes visible to the
-- whole instance. A coffee splits into the shared `SharedCoffee` (what is on
-- the bag) and the member's own `Coffee` (their bag: roast date, weights,
-- tags, notes). Existing data is kept: each existing coffee becomes a shared
-- coffee with the same id, created by its owner, plus that owner's bag of it,
-- so brews, favorites and links keep pointing at the same row.

-- CreateEnum
CREATE TYPE "public"."SuggestionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."SharedCoffee" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "roasterId" TEXT,
    "roasterNameSnapshot" TEXT,
    "country" TEXT,
    "region" TEXT,
    "farm" TEXT,
    "producer" TEXT,
    "varieties" TEXT[],
    "process" TEXT,
    "processingNotes" TEXT,
    "altitudeMinMasl" INTEGER,
    "altitudeMaxMasl" INTEGER,
    "roastLevel" "public"."RoastLevel" NOT NULL DEFAULT 'UNKNOWN',
    "roasterTastingNotes" TEXT[],
    "description" TEXT,
    "imageData" BYTEA,
    "imageMime" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCoffee_pkey" PRIMARY KEY ("id")
);

-- Data: the shared half of every existing coffee, created by its owner.
INSERT INTO "public"."SharedCoffee" (
    "id", "createdById", "name", "roasterId", "roasterNameSnapshot",
    "country", "region", "farm", "producer", "varieties", "process", "processingNotes",
    "altitudeMinMasl", "altitudeMaxMasl", "roastLevel", "roasterTastingNotes", "description",
    "imageData", "imageMime", "imageUpdatedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "ownerId", "name", "roasterId", "roasterNameSnapshot",
    "country", "region", "farm", "producer", "varieties", "process", "processingNotes",
    "altitudeMinMasl", "altitudeMaxMasl", "roastLevel", "roasterTastingNotes", "description",
    "imageData", "imageMime", "imageUpdatedAt", "createdAt", "updatedAt"
FROM "public"."Coffee";

-- CreateTable
CREATE TABLE "public"."CatalogSuggestion" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "sharedCoffeeId" TEXT,
    "roasterId" TEXT,
    "values" JSONB NOT NULL,
    "imageData" BYTEA,
    "imageMime" TEXT,
    "status" "public"."SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSuggestion_pkey" PRIMARY KEY ("id")
);

-- Coffee becomes the member's bag of a shared coffee.
ALTER TABLE "public"."Coffee" DROP CONSTRAINT "Coffee_roasterId_fkey";
DROP INDEX "public"."Coffee_roasterId_idx";
ALTER TABLE "public"."Coffee" ADD COLUMN "sharedCoffeeId" TEXT;
UPDATE "public"."Coffee" SET "sharedCoffeeId" = "id";
ALTER TABLE "public"."Coffee" ALTER COLUMN "sharedCoffeeId" SET NOT NULL;
ALTER TABLE "public"."Coffee" DROP COLUMN "altitudeMaxMasl",
DROP COLUMN "altitudeMinMasl",
DROP COLUMN "country",
DROP COLUMN "description",
DROP COLUMN "farm",
DROP COLUMN "imageData",
DROP COLUMN "imageMime",
DROP COLUMN "imageUpdatedAt",
DROP COLUMN "name",
DROP COLUMN "process",
DROP COLUMN "processingNotes",
DROP COLUMN "producer",
DROP COLUMN "region",
DROP COLUMN "roastLevel",
DROP COLUMN "roasterId",
DROP COLUMN "roasterNameSnapshot",
DROP COLUMN "roasterTastingNotes",
DROP COLUMN "varieties";

-- Roasters become shared; the owner becomes the creator.
ALTER TABLE "public"."Roaster" DROP CONSTRAINT "Roaster_ownerId_fkey";
DROP INDEX "public"."Roaster_ownerId_name_idx";
ALTER TABLE "public"."Roaster" RENAME COLUMN "ownerId" TO "createdById";

-- CreateIndex
CREATE INDEX "SharedCoffee_name_idx" ON "public"."SharedCoffee"("name");
CREATE INDEX "SharedCoffee_roasterId_idx" ON "public"."SharedCoffee"("roasterId");
CREATE INDEX "SharedCoffee_createdById_idx" ON "public"."SharedCoffee"("createdById");
CREATE INDEX "CatalogSuggestion_status_createdAt_idx" ON "public"."CatalogSuggestion"("status", "createdAt");
CREATE INDEX "CatalogSuggestion_sharedCoffeeId_idx" ON "public"."CatalogSuggestion"("sharedCoffeeId");
CREATE INDEX "CatalogSuggestion_roasterId_idx" ON "public"."CatalogSuggestion"("roasterId");
CREATE INDEX "CatalogSuggestion_authorId_idx" ON "public"."CatalogSuggestion"("authorId");
CREATE INDEX "Coffee_sharedCoffeeId_idx" ON "public"."Coffee"("sharedCoffeeId");
CREATE INDEX "Roaster_name_idx" ON "public"."Roaster"("name");
CREATE INDEX "Roaster_createdById_idx" ON "public"."Roaster"("createdById");

-- AddForeignKey
ALTER TABLE "public"."Roaster" ADD CONSTRAINT "Roaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."SharedCoffee" ADD CONSTRAINT "SharedCoffee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."SharedCoffee" ADD CONSTRAINT "SharedCoffee_roasterId_fkey" FOREIGN KEY ("roasterId") REFERENCES "public"."Roaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Coffee" ADD CONSTRAINT "Coffee_sharedCoffeeId_fkey" FOREIGN KEY ("sharedCoffeeId") REFERENCES "public"."SharedCoffee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_sharedCoffeeId_fkey" FOREIGN KEY ("sharedCoffeeId") REFERENCES "public"."SharedCoffee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_roasterId_fkey" FOREIGN KEY ("roasterId") REFERENCES "public"."Roaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A suggestion is about exactly one entry. Prisma cannot express this
-- constraint in the schema, so it lives here.
ALTER TABLE "public"."CatalogSuggestion" ADD CONSTRAINT "CatalogSuggestion_exactly_one_target"
  CHECK (num_nonnulls("sharedCoffeeId", "roasterId") = 1);
