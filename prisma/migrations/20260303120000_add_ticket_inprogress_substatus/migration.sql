-- CreateEnum
CREATE TYPE "InProgressSubStatus" AS ENUM ('PENDING_AGENT', 'PENDING_EMPLOYEE');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "inProgressSubStatus" "InProgressSubStatus";
