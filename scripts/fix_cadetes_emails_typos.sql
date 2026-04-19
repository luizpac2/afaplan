BEGIN;
-- Corrige typos do CSV original: IDs errados
-- fontanagff foi atribuído a 24-282 (já tem tonettipht), o correto é 24-382
UPDATE cadetes SET email = 'tp.fontanagff@fab.mil.br' WHERE id = '24-382';
-- alessandromasl foi atribuído a 24-286 (já tem linconwlcs), o correto é 24-386
UPDATE cadetes SET email = 'tp.alessandromasl@fab.mil.br' WHERE id = '24-386';
COMMIT;
