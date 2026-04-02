-- ============================================================
-- Migration: Reconstruir vínculo docente ↔ disciplina
-- Aplica na camada relacional do Supabase
-- ============================================================
-- Contexto: durante a migração Firebase → Supabase, a tabela
-- docente_disciplinas ficou vazia porque os vínculos estavam
-- desnormalizados nos documentos do Firebase.
-- Este script os reconstrói a partir de programacao_aulas.
-- ============================================================

-- 1. Popula docente_disciplinas com os pares que já aparecem
--    na grade de aulas (cada docente que ministra uma disciplina
--    é habilitado para ela automaticamente).
INSERT INTO docente_disciplinas (docente_id, disciplina_id, principal)
SELECT DISTINCT
    a.docente_id,
    a.disciplina_id,
    true AS principal
FROM programacao_aulas a
WHERE a.docente_id    IS NOT NULL
  AND a.disciplina_id IS NOT NULL
ON CONFLICT (docente_id, disciplina_id) DO NOTHING;

-- 2. Para cada disciplina na grade, define o docente que mais
--    a ministrou como "titular" na tabela disciplinas (campo
--    docente_id, se ele existir). Usando CTE de ranking.
--    Só atualiza linhas onde docente_id ainda está NULL.
WITH ranking AS (
    SELECT
        a.disciplina_id,
        a.docente_id,
        COUNT(*) AS total,
        ROW_NUMBER() OVER (
            PARTITION BY a.disciplina_id
            ORDER BY COUNT(*) DESC
        ) AS rn
    FROM programacao_aulas a
    WHERE a.docente_id    IS NOT NULL
      AND a.disciplina_id IS NOT NULL
    GROUP BY a.disciplina_id, a.docente_id
)
UPDATE disciplinas d
SET    docente_id = r.docente_id          -- coluna opcional, pode não existir
FROM   ranking r
WHERE  r.disciplina_id = d.id
  AND  r.rn = 1
  AND  (d.docente_id IS NULL OR d.docente_id = '00000000-0000-0000-0000-000000000000')
-- Se a coluna docente_id não existir, comente o UPDATE acima.
;

-- 3. Relatório: mostra o resultado
SELECT
    dc.trigrama            AS docente,
    dc.nome_guerra         AS nome,
    COUNT(dd.disciplina_id) AS total_disciplinas
FROM docentes dc
LEFT JOIN docente_disciplinas dd ON dd.docente_id = dc.id
GROUP BY dc.id, dc.trigrama, dc.nome_guerra
ORDER BY total_disciplinas DESC, dc.trigrama;
