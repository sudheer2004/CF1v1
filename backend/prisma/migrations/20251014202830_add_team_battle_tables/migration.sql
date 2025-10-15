-- CreateTable
CREATE TABLE "TeamBattle" (
    "id" TEXT NOT NULL,
    "battleCode" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "numProblems" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winningTeam" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBattlePlayer" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "cfHandle" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBattlePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBattleProblem" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 100,
    "useCustomLink" BOOLEAN NOT NULL DEFAULT false,
    "customLink" TEXT,
    "rating" INTEGER,
    "useRange" BOOLEAN NOT NULL DEFAULT false,
    "ratingMin" INTEGER,
    "ratingMax" INTEGER,
    "minYear" INTEGER,
    "contestId" INTEGER,
    "problemIndexChar" TEXT,
    "problemName" TEXT,
    "problemRating" INTEGER,
    "problemUrl" TEXT,
    "solvedBy" TEXT,
    "solvedByUserId" TEXT,
    "solvedByUsername" TEXT,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamBattleProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBattleAttempt" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBattleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattle_battleCode_key" ON "TeamBattle"("battleCode");

-- CreateIndex
CREATE INDEX "TeamBattle_battleCode_idx" ON "TeamBattle"("battleCode");

-- CreateIndex
CREATE INDEX "TeamBattle_status_idx" ON "TeamBattle"("status");

-- CreateIndex
CREATE INDEX "TeamBattle_creatorId_idx" ON "TeamBattle"("creatorId");

-- CreateIndex
CREATE INDEX "TeamBattlePlayer_battleId_team_idx" ON "TeamBattlePlayer"("battleId", "team");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattlePlayer_battleId_userId_key" ON "TeamBattlePlayer"("battleId", "userId");

-- CreateIndex
CREATE INDEX "TeamBattleProblem_battleId_idx" ON "TeamBattleProblem"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattleProblem_battleId_problemIndex_key" ON "TeamBattleProblem"("battleId", "problemIndex");

-- CreateIndex
CREATE INDEX "TeamBattleAttempt_battleId_userId_idx" ON "TeamBattleAttempt"("battleId", "userId");

-- CreateIndex
CREATE INDEX "TeamBattleAttempt_battleId_problemIndex_idx" ON "TeamBattleAttempt"("battleId", "problemIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattleAttempt_battleId_submissionId_key" ON "TeamBattleAttempt"("battleId", "submissionId");

-- AddForeignKey
ALTER TABLE "TeamBattlePlayer" ADD CONSTRAINT "TeamBattlePlayer_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "TeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBattleProblem" ADD CONSTRAINT "TeamBattleProblem_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "TeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
