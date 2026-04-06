import { supabase } from "../config/supabase";

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeEvent = (row: any): any => ({
  ...row,
  instructorTrigram: row.instructorTrigram ?? row.instructorId ?? null,
});

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
  supabase
    .from("programacao_aulas")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .then(({ data, error }) => {
      if (!error) callback((data ?? []).map(normalizeEvent));
      else callback([]);
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
