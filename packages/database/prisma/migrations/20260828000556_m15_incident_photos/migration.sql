-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
