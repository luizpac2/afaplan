import { supabase } from "../config/supabase";

// ---------------------------------------------------------------------------
// Mapa canônico: tabela de escrita → tabela/chave de leitura (cache)
// Usar sempre este mapa para invalidação — evita mismatches.
// ---------------------------------------------------------------------------
export const TABLE_READ: Record<string, string> = {
  disciplines:             "disciplines",
  disciplinas:             "disciplines",   // legado → cache da tabela de leitura
  instructors:             "instructors",
  cohorts:                 "cohorts",
  classes:                 "cohorts",       // classes são derivadas dos cohorts
  occurrences:             "occurrences",
  semester_configs:        "semester_configs",
  schedule_change_requests:"schedule_change_requests",
  visual_configs:          "visual_configs",
  visualConfigs:           "visual_configs", // legado
  notices:                 "notices",
  instruction_locations:   "instruction_locations",
  location_issues:         "location_issues",
  location_reservations:   "location_reservations",
};

/** Invalida o cache da tabela de leitura correspondente */
export const invalidateCache = (writeTable: string) => {
  const readTable = TABLE_READ[writeTable] ?? writeTable;
  const keys = [
    `afa_cache_v3_${readTable}`,
    `afa_cache_v2_${readTable}`,
    `afa_cache_${readTable}`,
  ];
  try { keys.forEach((k) => localStorage.removeItem(k)); } catch { /* ignora */ }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clean = (data: any): any =>
  JSON.parse(JSON.stringify(data, (_k, v) => (v === undefined ? null : v)));

/**
 * Normaliza uma linha de programacao_aulas para o formato ScheduleEvent.
 * O banco armazena instructorId; o frontend espera instructorTrigram.
 */
/** Garante formato HH:mm (com zero à esquerda) */
export const normalizeTime = (t: string | null | undefined): string => {
  if (!t) return t as string;
  // Remove segundos se presentes: "07:00:00" → "07:00"
  const withoutSeconds = t.length > 5 ? t.slice(0, 5) : t;
  // Adiciona zero à esquerda se necessário: "7:00" → "07:00"
  const [h, m] = withoutSeconds.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
};

export const normalizeEvent = (row: Record<string, unknown>): Record<string, unknown> => {
  // Mapeamento de snake_case português (banco) → camelCase (frontend)
  return {
    ...row,
    date:           row.date ?? row.data ?? null,
    startTime:      row.startTime ?? (row.horario_inicio ? normalizeTime(row.horario_inicio as string) : null),
    endTime:        row.endTime ?? (row.horario_fim ? normalizeTime(row.horario_fim as string) : null),
    classId:        row.classId ?? row.turma_id ?? row.class_id ?? null,
    disciplineId:   row.disciplineId ?? row.disciplina_id ?? row.discipline_id ?? null,
    instructorTrigram: row.instructorTrigram ?? row.instructorId ?? null,
    location:       row.location ?? row.local_id ?? null,
    evaluationType: row.evaluationType ?? row.evaluation_type ?? null,
    endDate:        row.endDate ?? row.end_date ?? null,
  };
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Busca todos os registros de uma tabela */
export const fetchCollection = async (tableName: string) => {
  const { data, error } = await supabase.from(tableName).select("*");
  if (error) throw error;
  return data ?? [];
};

/** Busca com cache localStorage (TTL em horas, padrão 4h) */
export const fetchCollectionCached = async (
  tableName: string,
  ttlHours = 4,
) => {
  const key = `afa_cache_v3_${tableName}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { data, ts } = JSON.parse(raw) as { data: unknown[]; ts: number };
      if (Date.now() - ts < ttlHours * 3_600_000) return data;
    }
  } catch { /* ignora cache corrompido */ }

  const data = await fetchCollection(tableName);
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded */ }
  return data;
};

/**
 * Substituto de subscribeToCollection — sem Realtime/WebSocket.
 * Faz fetch inicial e retorna unsubscribe no-op.
 * Realtime foi removido porque o projeto Supabase não tem a feature habilitada.
 */
export const subscribeToCollection = (
  tableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (data: any[]) => void,
) => {
  void fetchCollection(tableName)
    .then(callback)
    .catch(() => callback([]));
  return () => {}; // no-op unsubscribe
};

/**
 * Busca eventos por intervalo de datas — sem Realtime.
 */
export const subscribeToEventsByDateRange = (
  startDate: string,
  endDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (data: any[]) => void,
) => {
  // Busca eventos normais (date dentro da semana) + eventos acadêmicos multi-dia que
  // se sobrepõem à semana (date <= weekEnd e endDate >= weekStart)
  Promise.all([
    supabase
      .from("programacao_aulas")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("programacao_aulas")
      .select("*")
      .not("endDate", "is", null)
      .lte("date", endDate)
      .gte("endDate", startDate)
      .lt("date", startDate), // evita duplicatas (já buscados acima)
  ]).then(([r1, r2]) => {
    if (r1.error) {
      console.error("[subscribeToEventsByDateRange] Erro r1:", r1.error);
      callback([]);
      return;
    }
    const seen = new Set<string>();
    const rows = [...(r1.data ?? []), ...(r2.data ?? [])].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    console.log(`[subscribeToEventsByDateRange] ${startDate}→${endDate}: ${rows.length} eventos (antes dedup)`);
    // Deduplica por (classId, date, startTime) — mantém o evento com menor id (mais antigo)
    const slotSeen = new Map<string, typeof rows[0]>();
    rows.forEach(r => {
      if (r.type === 'ACADEMIC' || r.disciplineId === 'ACADEMIC') {
        slotSeen.set(r.id, r); // eventos acadêmicos nunca deduplicados
        return;
      }
      const slotKey = `${r.classId}|${r.date}|${normalizeTime(r.startTime)}`;
      // Mantém o mais recente: prefere o que tem type=EVALUATION, ou o último pelo id
      const existing = slotSeen.get(slotKey);
      if (!existing) { slotSeen.set(slotKey, r); return; }
      // Se o novo tem type EVALUATION e o existente não, prefere o novo
      if (r.type === "EVALUATION" && existing.type !== "EVALUATION") { slotSeen.set(slotKey, r); return; }
      // Senão, mantém o de id maior (mais recentemente criado/atualizado)
      if (r.id > existing.id) slotSeen.set(slotKey, r);
    });
    const deduped = [...slotSeen.values()];
    console.log(`[subscribeToEventsByDateRange] ${deduped.length} eventos após dedup`);
    callback(deduped.map(normalizeEvent));
  });
  return () => {};
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const saveDocument = async (
  tableName: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  idColumn = "id",
) => {
  const { error } = await supabase
    .from(tableName)
    .upsert({ ...clean(data), [idColumn]: id });
  if (error) {
    console.error(`[Save:${tableName}:${id}]`, error);
    throw error;
  }
};

export const updateDocument = async (
  tableName: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: any,
  idColumn = "id",
) => {
  const { error } = await supabase
    .from(tableName)
    .update(clean(updates))
    .eq(idColumn, id);
  if (error) {
    console.error(`[Update:${tableName}:${id}]`, error);
    throw error;
  }
};

export const deleteDocument = async (
  tableName: string,
  id: string,
  idColumn = "id",
) => {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq(idColumn, id);
  if (error) {
    console.error(`[Delete:${tableName}:${id}]`, error);
    throw error;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batchSave = async (tableName: string, items: any[]) => {
  if (!items.length) return;
  const { error } = await supabase.from(tableName).upsert(items.map(clean));
  if (error) {
    console.error(`[BatchSave:${tableName}]`, error);
    throw error;
  }
};

export const batchDelete = async (
  tableName: string,
  ids: string[],
  idColumn = "id",
) => {
  if (!ids.length) return;
  const { error } = await supabase.from(tableName).delete().in(idColumn, ids);
  if (error) {
    console.error(`[BatchDelete:${tableName}]`, error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// SAP
// ---------------------------------------------------------------------------

export const getNextSapNumber = async (
  _year: number,
  existingRequests?: { numeroAlteracao?: string }[],
): Promise<string> => {
  const shortYear = String(new Date().getFullYear()).slice(-2);
  const requests = existingRequests ?? [];
  const max = requests.reduce((acc, r) => {
    const m = r.numeroAlteracao?.match(/SAP (\d+)\//);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `SAP ${String(max + 1).padStart(3, "0")}/${shortYear}`;
};
