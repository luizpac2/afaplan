# Checklist: Nova Feature com Persistência no Supabase

Use este guia SEMPRE que implementar uma nova entidade com CRUD (tabela + edge function + store + componente).

> **Regra de ouro**: `saveDocument` e `updateDocument` usam a **anon key** — bloqueados por RLS em qualquer tabela que tenha `ALL TO service_role`. **Toda escrita** deve passar pela edge function `admin-manage-content` com service role. Nunca use `saveDocument`/`updateDocument` para persistir dados de admin.

---

## 1. Tabela SQL

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` — o banco gera o uuid, nunca o frontend
- Colunas em **snake_case** no banco (`location_id`, `created_at`, `start_time`)
- RLS: `SELECT TO authenticated`, `ALL TO service_role`
- Verificar se a migration já foi aplicada antes de re-executar (erro 42710 = policy já existe)

---

## 2. Edge Function (`admin-manage-content/index.ts`)

### Regra crítica: INSERT vs UPDATE

**NUNCA** fazer `if (l.id) update else insert` com id gerado no frontend.

Motivo: o frontend gera `crypto.randomUUID()` → `l.id` é truthy → edge fn faz `.update().eq("id", l.id)` → 0 linhas afetadas → retorna `{success:true}` sem inserir nada.

**Padrão correto para INSERT:**
```typescript
// Não recebe id — banco gera
const { data, error } = await adminClient.from("tabela")
  .insert(row).select("id").single();
if (error) return err(error.message, 500);
return ok({ success: true, id: data.id });
```

**Padrão correto para UPDATE:**
```typescript
// Recebe id existente do banco
const { error } = await adminClient.from("tabela")
  .update(row).eq("id", l.id as string);
if (error) return err(error.message, 500);
return ok({ success: true, id: l.id });
```

### Mapeamento camelCase → snake_case

Sempre mapear explicitamente. Nunca fazer spread do objeto JS direto no banco:
```typescript
const row = {
  location_id: l.locationId ?? l.location_id,
  start_time:  l.startTime  ?? l.start_time,
  created_by:  user.id,  // sempre do token, nunca do payload
};
```

### Colunas desconhecidas

Só enviar colunas que existem na tabela. Spread de objeto JS com campos camelCase causa erro `column "camelCaseField" does not exist`.

---

## 3. Store (`useCourseStore.ts`)

### addX — novo registro

```typescript
addLocation: async (location: InstructionLocation): Promise<string> => {
  // Remove id — banco gera
  const { id: _id, createdAt: _ca, ...payload } = location;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void _id; void _ca;
  const result = await contentFn("save_location", { location: payload });
  const realId = result.id as string;
  set((s) => ({ locations: [...s.locations, { ...location, id: realId }] }));
  invalidateStaticCache("tabela");
  return realId;
},
```

- `contentFn` retorna `Promise<Record<string, unknown>>` — usar o `id` retornado
- Fazer optimistic update **depois** do contentFn (ou atualizar o id no estado após receber o real)
- Sempre chamar `invalidateStaticCache("tabela")` após writes

### updateX / deleteX

```typescript
updateLocation: async (id, updates) => {
  set((s) => ({ locations: s.locations.map((l) => l.id === id ? { ...l, ...updates } : l) }));
  const loc = useCourseStore.getState().locations.find((l) => l.id === id);
  if (loc) await contentFn("save_location", { location: loc }); // passa id → edge fn faz update
  invalidateStaticCache("instruction_locations");
},
```

---

## 4. `TABLE_READ` map (`supabaseService.ts`)

Adicionar entrada para cada nova tabela **antes** de usar `invalidateStaticCache`:

```typescript
export const TABLE_READ: Record<string, string> = {
  // ...existentes...
  nova_tabela: "nova_tabela",
};
```

Sem essa entrada, `invalidateStaticCache("nova_tabela")` não limpa o localStorage e o cache velho é servido no próximo reload.

---

## 5. `SupabaseSync.tsx` — carregar dados

Usar `fetchCollectionCached` com TTL curto para dados que mudam com frequência:

```typescript
const locs = await fetchCollectionCached("nova_tabela", 0.1); // 6 min TTL
setLocations((locs as any[]).map((l) => ({
  ...l,
  // mapear snake_case → camelCase aqui
  locationId: l.location_id ?? l.locationId,
  createdAt:  l.created_at  ?? l.createdAt,
})) as NovaEntidade[]);
```

---

## 6. Componente — IDs

- **Novo registro**: `id: ""` (vazio) ao chamar `addX`. Usar o id retornado pela Promise para `setSelectedId`.
- **Nunca** usar `crypto.randomUUID()` para ids que vão ao banco — só para ids temporários de UI que nunca persistem.

---

## 7. Deploy

```bash
npx supabase functions deploy admin-manage-content --no-verify-jwt
```

Sempre com `--no-verify-jwt` (JWT usa ES256, não HS256).

---

## Checklist rápido antes de fechar a task

- [ ] Migration aplicada (sem erro 42710)?
- [ ] Edge fn usa insert sem id para novos registros e retorna o id gerado?
- [ ] Row enviado ao banco usa snake_case e só colunas conhecidas?
- [ ] `contentFn` retorna o id e o store o usa?
- [ ] `TABLE_READ` tem entrada para a nova tabela?
- [ ] `SupabaseSync` mapeia snake_case → camelCase?
- [ ] Componente usa id retornado (não o gerado no frontend)?
- [ ] `invalidateStaticCache` chamado após cada write?
- [ ] Deploy feito com `--no-verify-jwt`?
