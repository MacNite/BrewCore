-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Locale" AS ENUM ('de', 'en');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RoastLevel" AS ENUM ('LIGHT', 'MEDIUM_LIGHT', 'MEDIUM', 'MEDIUM_DARK', 'DARK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."GrinderType" AS ENUM ('HAND', 'ELECTRIC', 'BUILT_IN');

-- CreateEnum
CREATE TYPE "public"."GrinderAdjustmentType" AS ENUM ('CLICK', 'NUMBER', 'STEPLESS', 'MICRON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."BrewMethodType" AS ENUM ('POUR_OVER', 'IMMERSION', 'HYBRID', 'AEROPRESS', 'ESPRESSO', 'MOKA', 'FRENCH_PRESS', 'COLD_BREW', 'CUPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."GrindLevel" AS ENUM ('EXTRA_FINE', 'FINE', 'MEDIUM_FINE', 'MEDIUM', 'MEDIUM_COARSE', 'COARSE');

-- CreateEnum
CREATE TYPE "public"."RecipeStepType" AS ENUM ('PREPARE', 'TARE', 'ADD_COFFEE', 'BLOOM', 'POUR', 'WAIT', 'STIR', 'SWIRL', 'PRESS', 'BREAK_CRUST', 'DRAW_DOWN', 'STOP', 'SERVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."BrewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "language" "public"."Locale" NOT NULL DEFAULT 'de',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "cueSound" BOOLEAN NOT NULL DEFAULT true,
    "cueVibration" BOOLEAN NOT NULL DEFAULT true,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Roaster" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Roaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Coffee" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
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
    "roastDate" DATE,
    "purchaseDate" DATE,
    "openedDate" DATE,
    "bagWeightG" DECIMAL(8,2),
    "remainingWeightG" DECIMAL(8,2),
    "roasterTastingNotes" TEXT[],
    "userTags" TEXT[],
    "description" TEXT,
    "notes" TEXT,
    "imageData" BYTEA,
    "imageMime" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Coffee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GrinderModel" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "slug" TEXT,
    "type" "public"."GrinderType" NOT NULL,
    "burrType" TEXT,
    "burrDiameterMm" INTEGER,
    "adjustmentType" "public"."GrinderAdjustmentType" NOT NULL,
    "settingUnit" TEXT,
    "minSetting" DECIMAL(8,2),
    "maxSetting" DECIMAL(8,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "GrinderModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserGrinder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "grinderModelId" TEXT NOT NULL,
    "nickname" TEXT,
    "burrDescription" TEXT,
    "burrInstallDate" DATE,
    "zeroPoint" TEXT,
    "calibrationNotes" TEXT,
    "defaultForFilter" BOOLEAN NOT NULL DEFAULT false,
    "defaultForEspresso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "UserGrinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Brewer" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "slug" TEXT,
    "manufacturer" TEXT,
    "model" TEXT NOT NULL,
    "methodType" "public"."BrewMethodType" NOT NULL,
    "capacityMl" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Brewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recipe" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "bundledKey" TEXT,
    "forkedFromRecipeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brewerId" TEXT,
    "methodType" "public"."BrewMethodType" NOT NULL,
    "defaultCoffeeDoseG" DECIMAL(8,2) NOT NULL,
    "defaultWaterG" DECIMAL(8,2) NOT NULL,
    "targetYieldG" DECIMAL(8,2),
    "waterTemperatureC" DECIMAL(5,2),
    "grindDescription" "public"."GrindLevel",
    "targetBrewTimeSeconds" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "public"."RecipeStepType" NOT NULL,
    "title" TEXT,
    "instruction" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "targetElapsedSeconds" INTEGER,
    "targetElapsedMaxSeconds" INTEGER,
    "waterTargetG" DECIMAL(8,2),
    "temperatureC" DECIMAL(5,2),
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "autoAdvance" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Brew" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "recipeId" TEXT,
    "coffeeId" TEXT,
    "userGrinderId" TEXT,
    "brewerId" TEXT,
    "parentBrewId" TEXT,
    "status" "public"."BrewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "coffeeDoseG" DECIMAL(8,2) NOT NULL,
    "waterTargetG" DECIMAL(8,2) NOT NULL,
    "waterActualG" DECIMAL(8,2),
    "beverageWeightG" DECIMAL(8,2),
    "ratio" DECIMAL(8,4) NOT NULL,
    "waterTemperatureC" DECIMAL(5,2),
    "grindSettingText" TEXT,
    "grindSettingNumeric" DECIMAL(8,2),
    "grindSettingUnit" TEXT,
    "grindSettingNote" TEXT,
    "targetDurationSeconds" INTEGER,
    "actualDurationSeconds" INTEGER,
    "notes" TEXT,
    "recipeNameSnapshot" TEXT NOT NULL,
    "coffeeNameSnapshot" TEXT,
    "roasterSnapshot" TEXT,
    "roastDateSnapshot" DATE,
    "grinderSnapshot" TEXT,
    "brewerSnapshot" TEXT,
    "recipeSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrewStepResult" (
    "id" TEXT NOT NULL,
    "brewId" TEXT NOT NULL,
    "recipeStepId" TEXT,
    "position" INTEGER NOT NULL,
    "type" "public"."RecipeStepType" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "targetWeightG" DECIMAL(8,2),
    "actualWeightG" DECIMAL(8,2),
    "targetDurationSeconds" INTEGER,
    "actualDurationSeconds" INTEGER,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "BrewStepResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tasting" (
    "id" TEXT NOT NULL,
    "brewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "wouldBrewAgain" BOOLEAN,
    "tags" TEXT[],
    "acidity" INTEGER,
    "sweetness" INTEGER,
    "bitterness" INTEGER,
    "body" INTEGER,
    "clarity" INTEGER,
    "aftertaste" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "coffeeId" TEXT,
    "recipeId" TEXT,
    "brewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "public"."Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "public"."UserInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvitation_email_createdAt_idx" ON "public"."UserInvitation"("email", "createdAt");

-- CreateIndex
CREATE INDEX "UserInvitation_expiresAt_idx" ON "public"."UserInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "public"."RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "Roaster_ownerId_name_idx" ON "public"."Roaster"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Coffee_ownerId_archivedAt_idx" ON "public"."Coffee"("ownerId", "archivedAt");

-- CreateIndex
CREATE INDEX "Coffee_roasterId_idx" ON "public"."Coffee"("roasterId");

-- CreateIndex
CREATE UNIQUE INDEX "GrinderModel_slug_key" ON "public"."GrinderModel"("slug");

-- CreateIndex
CREATE INDEX "GrinderModel_ownerId_idx" ON "public"."GrinderModel"("ownerId");

-- CreateIndex
CREATE INDEX "UserGrinder_ownerId_archivedAt_idx" ON "public"."UserGrinder"("ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brewer_slug_key" ON "public"."Brewer"("slug");

-- CreateIndex
CREATE INDEX "Brewer_ownerId_idx" ON "public"."Brewer"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_bundledKey_key" ON "public"."Recipe"("bundledKey");

-- CreateIndex
CREATE INDEX "Recipe_ownerId_archivedAt_idx" ON "public"."Recipe"("ownerId", "archivedAt");

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_position_idx" ON "public"."RecipeStep"("recipeId", "position");

-- CreateIndex
CREATE INDEX "Brew_ownerId_createdAt_idx" ON "public"."Brew"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Brew_ownerId_status_idx" ON "public"."Brew"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Brew_ownerId_recipeId_userGrinderId_idx" ON "public"."Brew"("ownerId", "recipeId", "userGrinderId");

-- CreateIndex
CREATE INDEX "Brew_coffeeId_idx" ON "public"."Brew"("coffeeId");

-- CreateIndex
CREATE INDEX "BrewStepResult_brewId_position_idx" ON "public"."BrewStepResult"("brewId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Tasting_brewId_key" ON "public"."Tasting"("brewId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_ownerId_coffeeId_key" ON "public"."Favorite"("ownerId", "coffeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_ownerId_recipeId_key" ON "public"."Favorite"("ownerId", "recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_ownerId_brewId_key" ON "public"."Favorite"("ownerId", "brewId");

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roaster" ADD CONSTRAINT "Roaster_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Coffee" ADD CONSTRAINT "Coffee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Coffee" ADD CONSTRAINT "Coffee_roasterId_fkey" FOREIGN KEY ("roasterId") REFERENCES "public"."Roaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GrinderModel" ADD CONSTRAINT "GrinderModel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserGrinder" ADD CONSTRAINT "UserGrinder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserGrinder" ADD CONSTRAINT "UserGrinder_grinderModelId_fkey" FOREIGN KEY ("grinderModelId") REFERENCES "public"."GrinderModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brewer" ADD CONSTRAINT "Brewer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recipe" ADD CONSTRAINT "Recipe_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recipe" ADD CONSTRAINT "Recipe_brewerId_fkey" FOREIGN KEY ("brewerId") REFERENCES "public"."Brewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recipe" ADD CONSTRAINT "Recipe_forkedFromRecipeId_fkey" FOREIGN KEY ("forkedFromRecipeId") REFERENCES "public"."Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "public"."Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "public"."Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_coffeeId_fkey" FOREIGN KEY ("coffeeId") REFERENCES "public"."Coffee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_userGrinderId_fkey" FOREIGN KEY ("userGrinderId") REFERENCES "public"."UserGrinder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_brewerId_fkey" FOREIGN KEY ("brewerId") REFERENCES "public"."Brewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brew" ADD CONSTRAINT "Brew_parentBrewId_fkey" FOREIGN KEY ("parentBrewId") REFERENCES "public"."Brew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrewStepResult" ADD CONSTRAINT "BrewStepResult_brewId_fkey" FOREIGN KEY ("brewId") REFERENCES "public"."Brew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrewStepResult" ADD CONSTRAINT "BrewStepResult_recipeStepId_fkey" FOREIGN KEY ("recipeStepId") REFERENCES "public"."RecipeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tasting" ADD CONSTRAINT "Tasting_brewId_fkey" FOREIGN KEY ("brewId") REFERENCES "public"."Brew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_coffeeId_fkey" FOREIGN KEY ("coffeeId") REFERENCES "public"."Coffee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "public"."Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_brewId_fkey" FOREIGN KEY ("brewId") REFERENCES "public"."Brew"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A favorite points at exactly one target (§64). Prisma cannot express this
-- constraint in the schema, so it lives here.
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_exactly_one_target"
  CHECK (num_nonnulls("coffeeId", "recipeId", "brewId") = 1);

-- Tasting scores are 1-5 (§30).
ALTER TABLE "Tasting" ADD CONSTRAINT "Tasting_scores_range" CHECK (
  "rating" BETWEEN 1 AND 5
  AND ("acidity" IS NULL OR "acidity" BETWEEN 1 AND 5)
  AND ("sweetness" IS NULL OR "sweetness" BETWEEN 1 AND 5)
  AND ("bitterness" IS NULL OR "bitterness" BETWEEN 1 AND 5)
  AND ("body" IS NULL OR "body" BETWEEN 1 AND 5)
  AND ("clarity" IS NULL OR "clarity" BETWEEN 1 AND 5)
  AND ("aftertaste" IS NULL OR "aftertaste" BETWEEN 1 AND 5)
);
