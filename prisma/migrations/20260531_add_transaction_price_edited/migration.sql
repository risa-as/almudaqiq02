-- Adds a flag marking a sale where one or more line prices were changed from
-- the catalog (unit) price at sale time. Used by the invoices page to badge the
-- transaction and computed server-side in app/api/transactions on POST.

ALTER TABLE "Transaction"
  ADD COLUMN "priceEdited" BOOLEAN NOT NULL DEFAULT false;
