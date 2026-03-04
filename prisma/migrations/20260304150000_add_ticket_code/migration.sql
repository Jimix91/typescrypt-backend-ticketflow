-- Add public ticket code for user-facing identification
ALTER TABLE "Ticket"
ADD COLUMN "ticketCode" TEXT;

CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");
