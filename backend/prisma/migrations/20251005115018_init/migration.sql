-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "username" TEXT NOT NULL,
    "cfHandle" TEXT,
    "googleId" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchmakingQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ratingMin" INTEGER NOT NULL,
    "ratingMax" INTEGER NOT NULL,
    "tags" TEXT[],
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchmakingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "duelCode" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "opponentId" TEXT,
    "ratingMin" INTEGER NOT NULL,
    "ratingMax" INTEGER NOT NULL,
    "tags" TEXT[],
    "duration" INTEGER NOT NULL,
    "problemId" TEXT,
    "problemName" TEXT,
    "problemRating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "problemName" TEXT NOT NULL,
    "problemRating" INTEGER,
    "problemTags" TEXT[],
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "winnerId" TEXT,
    "player1Submissions" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "player2Submissions" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "player1RatingBefore" INTEGER NOT NULL,
    "player1RatingAfter" INTEGER,
    "player1RatingChange" INTEGER,
    "player2RatingBefore" INTEGER NOT NULL,
    "player2RatingAfter" INTEGER,
    "player2RatingChange" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_cfHandle_key" ON "User"("cfHandle");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_status_createdAt_idx" ON "MatchmakingQueue"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Duel_duelCode_key" ON "Duel"("duelCode");

-- CreateIndex
CREATE INDEX "Duel_duelCode_idx" ON "Duel"("duelCode");

-- CreateIndex
CREATE INDEX "Duel_status_idx" ON "Duel"("status");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_player1Id_createdAt_idx" ON "Match"("player1Id", "createdAt");

-- CreateIndex
CREATE INDEX "Match_player2Id_createdAt_idx" ON "Match"("player2Id", "createdAt");

-- AddForeignKey
ALTER TABLE "MatchmakingQueue" ADD CONSTRAINT "MatchmakingQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
