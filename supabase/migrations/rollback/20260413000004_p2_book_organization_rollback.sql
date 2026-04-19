-- Full teardown for the E94-S03 P2 book organization migration.
-- Covers: 20260413000004_p2_book_organization.sql
--   4 tables: book_reviews, shelves, book_shelves, reading_queue
--
-- DESTRUCTIVE: drops all E94-S03 tables and their data. Use only
-- for dev DB reset or disaster recovery.
--
-- E94-S01 P2 library tables (books, authors, imported_*), P1 tables, P0 tables,
-- and extensions (moddatetime, etc.) are intentionally NOT touched.
--
-- Drop order: reverse of creation. No inter-table FKs exist within this
-- migration, but book_shelves references shelves logically (by shelf_id UUID) —
-- dropping in reverse creation order is conventional.

BEGIN;

DROP TABLE IF EXISTS public.reading_queue CASCADE;
DROP TABLE IF EXISTS public.book_shelves CASCADE;
DROP TABLE IF EXISTS public.shelves CASCADE;
DROP TABLE IF EXISTS public.book_reviews CASCADE;

COMMIT;
