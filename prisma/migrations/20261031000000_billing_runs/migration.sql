-- CreateTable
CREATE TABLE "billing_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "triggered_by" TEXT,

    CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: the billing engine writes a human-readable quantity on invoice lines.
ALTER TABLE "invoice_lines" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
UPDATE "invoice_lines" SET "quantity" = "qty";

-- Align money precision with prisma/schema.prisma (DECIMAL(12,2)).
ALTER TABLE "invoices"
    ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "discount_total" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "tax_total" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "amount_paid" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "invoice_lines"
    ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "tax_amount" SET DATA TYPE DECIMAL(12,2),
    ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "invoice_discounts"
    ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "payments"
    ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);
