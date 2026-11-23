-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Generation_sid_createdAt_idx" ON "Generation"("sid", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_ipHash_createdAt_idx" ON "Generation"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_cacheKey_idx" ON "Generation"("cacheKey");

-- CreateIndex
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");
