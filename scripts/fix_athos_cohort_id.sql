-- ============================================================
-- fix_athos_cohort_id.sql
-- Corrige cohort_id dos cadetes da Turma Athos (23-xxx)
-- de '3' (Uiraçu) para '4' (Athos)
-- Execute no SQL Editor do Supabase
-- ============================================================

UPDATE public.cadetes
SET cohort_id = '4', updated_at = now()
WHERE id LIKE '23-%'
  AND cohort_id = '3';
