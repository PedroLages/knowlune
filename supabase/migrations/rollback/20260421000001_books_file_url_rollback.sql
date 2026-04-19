-- Rollback: E94-S07 books file_url column
-- Drops the file_url column added by 20260421000001_books_file_url.sql.

ALTER TABLE public.books DROP COLUMN IF EXISTS file_url;
