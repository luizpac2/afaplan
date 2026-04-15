import { supabase } from "../config/supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Remove valores undefined (Supabase não aceita undefined, apenas null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clean = (data: any): any =>
  JSON.parse(JSON.stringify(data, (_k, v) => (v === undefined ? null : v)));

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Busca todos os registros de uma tabela */
export const fetchCollection = async (tableName: string) => {
  const { data, error } = await supabase.from(tableName).select("*");
  if (error) throw error;
  return data ?? [];
};

/** Busca com cache localStorage (TTL em horas) */
export const fetchCollectionCached = async (
  tableName: string,
  ttlHours = 24,
) => {
  const key = `afa_cache_${tableName}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { data, ts } = JSON.parse(raw) as { data: unknown[]; ts: number };
      if (Date.now() - ts < ttlHours * 3_600_000) {
        console.log(`⚡ Cache hit: ${tableName} (0 reads)`);
        return data;
      }
    }
  } catch {
    console.warn(`Cache inválido para ${tableName}, buscando do DB...`);
  }

  console.log(`📡 Fetching from Supabase: ${tableName}...`);
  const data = await fetchCollection(tableName);
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    console.warn(`Falha ao salvar ${tableName} no localStorage`);
  }
  return data;
};

// ---------------------------------------------------------------------------
// Realtime (substitui onSnapshot / subscribeToCollection)
// ---------------------------------------------------------------------------

/** Inscreve em mudanças em tempo real de uma tabela */
export const subscribeToCollection = (
  tableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (data: any[]) => void,
) => {
  // Carrega dados iniciais
  void fetchCollection(tableName).then(callback);

  const channel = supabase
    .channel(`realtime:${tableName}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      async () => {
        // Re-fetch completo ao receber qualquer mudança
        const fresh = await fetchCollection(tableName);
        callback(fresh);
      },
    )
    .subscribe();

  // Retorna função de cleanup (mesmo contrato que Firestore Unsubscribe)
  return () => { void supabase.removeChannel(channel); };
};

/**
 * Inscreve em mudanças de eventos dentro de um intervalo de datas.
 * Substitui subscribeToQuery(query(collection(db, 'events'), where('date', '>=', start), ...))
 */
export const subscribeToEventsByDateRange = (
  startDate: string,
  endDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (data: any[]) => void,
) => {
  const fetch = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);
    if (!error) callback(data ?? []);
  };

  void fetch();

  const channel = supabase
    .channel(`events:${startDate}:${endDate}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
      void fetch();
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Cria ou substitui um registro (equivalente a setDoc sem merge) */
export const saveDocument = async (
  tableName: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
) => {
  const { error } = await supabase
    .from(tableName)
    .upsert({ id, ...clean(data) });
  if (error) {
    console.error(`[Supabase Save:${tableName}:${id}]`, error);
    throw error;
  }
};

/** Atualiza campos específicos de um registro */
export const updateDocument = async (
  tableName: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updates: any,
) => {
  const { error } = await supabase
    .from(tableName)
    .update(clean(updates))
    .eq("id", id);
  if (error) {
    console.error(`[Supabase Update:${tableName}:${id}]`, error);
    throw error;
  }
};

/** Remove um registro */
export const deleteDocument = async (tableName: string, id: string) => {
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) {
    console.error(`[Supabase Delete:${tableName}:${id}]`, error);
    throw error;
  }
};

/** Insere ou atualiza vários registros em lote */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batchSave = async (tableName: string, items: any[]) => {
  if (!items.length) return;
  const { error } = await supabase
    .from(tableName)
    .upsert(items.map(clean));
  if (error) {
    console.error(`[Supabase BatchSave:${tableName}]`, error);
    throw error;
  }
};

/** Remove vários registros por ID */
export const batchDelete = async (tableName: string, ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase
    .from(tableName)
    .delete()
    .in("id", ids);
  if (error) {
    console.error(`[Supabase BatchDelete:${tableName}]`, error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// SAP — número gerado pelo trigger no banco (gerar_numero_sap)
// ---------------------------------------------------------------------------

/**
 * Retorna o próximo número SAP inserindo um registro provisório e lendo o
 * número gerado pelo trigger do banco. Remove o provisório logo em seguida.
 * Na prática, o número definitivo é gerado automaticamente no INSERT real.
 */
export const getNextSapNumber = async (
  _year: number,
  existingRequests?: { numeroAlteracao?: string }[],
): Promise<string> => {
  // Fallback local: calcula a partir da lista existente
  const shortYear = String(new Date().getFullYear()).slice(-2);
  const requests  = existingRequests ?? [];
  const max = requests.reduce((acc, r) => {
    const m = r.numeroAlteracao?.match(/SAP (\d+)\//);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `SAP ${String(max + 1).padStart(3, "0")}/${shortYear}`;
  // Nota: o número definitivo é gerado pelo trigger `gerar_numero_sap`
  // no banco ao fazer o INSERT em solicitacoes_sap.
};
