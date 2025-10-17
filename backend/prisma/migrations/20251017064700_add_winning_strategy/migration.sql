-- AlterTable
ALTER TABLE "TeamBattle" ADD COLUMN     "winningStrategy" TEXT NOT NULL DEFAULT 'first-solve';

-- CreateTable
CREATE TABLE "TeamBattleProblemSolve" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBattleProblemSolve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamBattleProblemSolve_battleId_team_idx" ON "TeamBattleProblemSolve"("battleId", "team");

-- CreateIndex
CREATE INDEX "TeamBattleProblemSolve_battleId_problemIndex_idx" ON "TeamBattleProblemSolve"("battleId", "problemIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBattleProblemSolve_battleId_problemIndex_userId_key" ON "TeamBattleProblemSolve"("battleId", "problemIndex", "userId");

-- AddForeignKey
ALTER TABLE "TeamBattleProblemSolve" ADD CONSTRAINT "TeamBattleProblemSolve_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "TeamBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
