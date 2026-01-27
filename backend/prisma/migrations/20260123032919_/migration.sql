-- CreateTable
CREATE TABLE "GlobalMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,

    CONSTRAINT "GlobalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalMessage_createdAt_idx" ON "GlobalMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "GlobalMessage" ADD CONSTRAINT "GlobalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
