# Frontend React — Migração Firebase → Supabase

## Setup do cliente Supabase

```typescript
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY   // NUNCA usar service_role no frontend
);

// .env (Vite)
// VITE_SUPABASE_URL=https://[REF].supabase.co
// VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Autenticação: Firebase → Supabase

### Antes (Firebase)
```typescript
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  setCurrentUser(user);
});

await signInWithEmailAndPassword(auth, email, password);
await signOut(auth);
```

### Depois (Supabase)
```typescript
import { supabase } from '../lib/supabaseClient';

// Listener de sessão (equivalente ao onAuthStateChanged)
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => setSession(session)
  );

  return () => subscription.unsubscribe();
}, []);

// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// Logout
await supabase.auth.signOut();

// Obter usuário atual
const { data: { user } } = await supabase.auth.getUser();
```

---

## Hook: useCurrentRole

```typescript
// src/hooks/useCurrentRole.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type UserRole = 'cadete' | 'docente' | 'gestor' | 'super_admin';

export function useCurrentRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('user_roles')
      .select('role, turma_id')
      .single()
      .then(({ data }) => {
        if (data) {
          setRole(data.role);
          setTurmaId(data.turma_id);
        }
      });
  }, []);

  return { role, turmaId, isAdmin: role === 'super_admin' || role === 'gestor' };
}
```

---

## Grade Semanal do Esquadrão (tela de Programação)

### Antes (Firebase)
```typescript
useEffect(() => {
  const q = query(
    collection(db, 'programacao'),
    where('turmaId', '==', turmaId),
    where('data', '>=', semanaInicio),
    where('data', '<=', semanaFim)
  );
  const unsubscribe = onSnapshot(q, (snapshot) => {
    setAulas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return unsubscribe;
}, [turmaId, semanaInicio, semanaFim]);
```

### Depois (Supabase — usando a View grade_semanal)
```typescript
useEffect(() => {
  async function fetchGrade() {
    setLoading(true);
    const { data, error } = await supabase
      .from('grade_semanal')       // View que já faz todos os JOINs
      .select('*')
      .eq('turma_id', turmaId)    // RLS já garante acesso, mas filtramos mesmo assim
      .gte('data', semanaInicio)
      .lte('data', semanaFim)
      .order('data')
      .order('horario_inicio');

    if (!error) setAulas(data || []);
    setLoading(false);
  }

  fetchGrade();

  // Realtime para atualizar a grade sem F5
  const channel = supabase
    .channel(`grade-${turmaId}-${semanaInicio}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'programacao_aulas',
      filter: `turma_id=eq.${turmaId}`
    }, () => fetchGrade())  // recarregar ao detectar mudança
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [turmaId, semanaInicio, semanaFim]);
```

---

## Tela de Disciplinas (Planejamento > Disciplinas > Gerenciar)

```typescript
// Buscar disciplinas com instrutor e carga horária por turma
const { data: disciplinas } = await supabase
  .from('disciplinas')
  .select(`
    id, sigla, nome, categoria, carga_horaria, ano_curso, campo,
    disciplina_criterios (freq_semanal, max_aulas_dia, local_padrao_id),
    docente_disciplinas (
      docente_id,
      docentes (trigrama, nome_guerra, vinculo)
    )
  `)
  .order('nome');

// Criar nova disciplina
const { error } = await supabase
  .from('disciplinas')
  .insert({ sigla, nome, categoria, carga_horaria, ano_curso });
```

---

## Tela de Docentes (Planejamento > Docentes > Gerenciar)

```typescript
// Buscar docentes com disciplinas e turmas
const { data: docentes } = await supabase
  .from('docentes')
  .select(`
    id, trigrama, nome_guerra, vinculo, carga_horaria_max,
    docente_disciplinas (
      disciplinas (sigla, nome)
    )
  `)
  .eq('ativo', true)
  .order('nome_guerra');

// Filtros rápidos disponíveis na UI:
// "Sem Disciplina" → disciplinas.count = 0
// "Sem Turma" → não tem nenhuma turma associada
// "Sem CH" → carga_horaria_max = 0

// Painel do docente (Docente > Relatórios)
const { data: agenda } = await supabase
  .from('painel_docente')   // View
  .select('*')
  .eq('docente_id', docenteId)
  .gte('data', anoLetivoInicio)
  .lte('data', anoLetivoFim)
  .order('data')
  .order('horario_inicio');
```

---

## Tela de SAP (Planejamento > Alterações)

```typescript
// Buscar SAPs com dados da aula relacionada
const { data: saps } = await supabase
  .from('solicitacoes_sap')
  .select(`
    id, numero, motivo, status, created_at, solicitante_nome,
    programacao_aulas (
      data, horario_inicio,
      disciplinas (sigla, nome),
      docentes (trigrama, nome_guerra),
      turmas (nome, esquadrao)
    )
  `)
  .order('created_at', { ascending: false });

// Criar nova SAP
const { error } = await supabase
  .from('solicitacoes_sap')
  .insert({
    aula_id: aulaId,
    motivo: motivo,
    solicitante_nome: user.user_metadata.nome
    // numero é gerado automaticamente pelo trigger
  });

// Aprovar SAP (apenas gestores — RLS garante)
const { error } = await supabase
  .from('solicitacoes_sap')
  .update({
    status: 'aprovada',
    aprovado_por: user.id,
    aprovado_em: new Date().toISOString()
  })
  .eq('id', sapId);
```

---

## Calendário Acadêmico (Programação > Calendário)

```typescript
// Buscar todos os eventos do mês (aulas + bloqueios)
async function fetchCalendarioMes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const fim = new Date(ano, mes, 0).toISOString().split('T')[0];

  const [{ data: aulas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from('grade_semanal')
      .select('data, turma_nome, esquadrao, disciplina_sigla, disciplina_categoria, docente_trigrama')
      .gte('data', inicio)
      .lte('data', fim),
    supabase
      .from('feriados_bloqueios')
      .select('data_inicio, data_fim, titulo, tipo, turma_id')
      .lte('data_inicio', fim)
      .gte('data_fim', inicio)
  ]);

  return { aulas, bloqueios };
}
```

---

## Chamada à Edge Function de Automação

```typescript
// Substituir lógica de automação do browser pela Edge Function
async function executarAutomacao(esquadraoId: string, periodo: { inicio: string; fim: string }) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-automation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        esquadrao_id: esquadraoId,
        data_inicio: periodo.inicio,
        data_fim: periodo.fim
      })
    }
  );

  const resultado = await response.json();

  if (!resultado.success) {
    if (resultado.conflitos?.length > 0) {
      // Mostrar conflitos na UI (tabela de conflitos detectados)
      setConflitos(resultado.conflitos);
    }
    return;
  }

  message.success(`${resultado.aulas_criadas} aulas alocadas com sucesso!`);
  refetchGrade(); // recarregar a grade
}
```

---

## Exportação CSV/PDF (botões na UI)

```typescript
// Exportar grade do esquadrão (equivalente ao botão "Exportar" na tela)
async function exportarGrade(turmaId: string, semanaInicio: string, semanaFim: string) {
  const { data } = await supabase
    .from('grade_semanal')
    .select('*')
    .eq('turma_id', turmaId)
    .gte('data', semanaInicio)
    .lte('data', semanaFim)
    .csv();  // Supabase retorna CSV nativo

  const blob = new Blob([data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grade_${turmaId}_${semanaInicio}.csv`;
  a.click();
}
```

---

## Variáveis de Ambiente (Vite)

```bash
# .env.local
VITE_SUPABASE_URL=https://[REF].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NÃO adicionar ao .env do frontend:
# SUPABASE_SERVICE_ROLE_KEY  ← apenas em Edge Functions / scripts server-side
```
