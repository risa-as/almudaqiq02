-- Make ProductUnit.barcode nullable so units without barcodes can sync to cloud.
-- Previously TEXT NOT NULL caused the first unit ("قطعة") to fail silently on push
-- when no barcode was provided by the user.
ALTER TABLE "ProductUnit" ALTER COLUMN "barcode" DROP NOT NULL;
