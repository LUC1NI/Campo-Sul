-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('EMITIDO', 'ERRO_PDF');

-- AlterTable
ALTER TABLE "Documento"
  ADD COLUMN "statusDoc" "StatusDocumento" NOT NULL DEFAULT 'EMITIDO',
  ADD COLUMN "erroInfo" TEXT;
