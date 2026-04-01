# Inteligência e Automação — Edge Functions & Realtime

## Arquitetura do Módulo de Inteligência

```
[Frontend React]
     │
     ├── POST /functions/v1/run-automation   → Edge Function: alocação automática
     ├── POST /functions/v1/check-conflicts  → Edge Function: verificar conflitos
     └── Realtime channel: solicitacoes_sap  → WebSocket automático Supabase
```

---

## Edge Function 1: Automação de Programação

Substitui a lógica atual do browser. Roda no servidor, acessa o banco diretamente.

```typescript
// supabase/functions/run-automation/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AutomationRequest {
  esquadrao_id: string;
  data_inicio: string;  // YYYY-MM-DD
  data_fim: string;
  substituir_existente?: boolean;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service_role para bypassar RLS
  );

  const body: AutomationRequest = await req.json();

  try {
    // 1. Buscar turma e disciplinas com critérios
    const { data: turma } = await supabase
      .from('turmas')
      .select('id, nome, esquadrao')
      .eq('id', body.esquadrao_id)
      .single();

    const { data: disciplinas } = await supabase
      .from('disciplinas')
      .select(`
        id, sigla, nome, carga_horaria,
        disciplina_criterios (freq_semanal, max_aulas_dia, dias_consecutivos, local_padrao_id, semestre),
        docente_disciplinas (docente_id)
      `)
      .eq('ano_curso', turma.esquadrao);

    // 2. Buscar bloqueios no período
    const { data: bloqueios } = await supabase
      .from('feriados_bloqueios')
      .select('data_inicio, data_fim')
      .or(`turma_id.is.null,turma_id.eq.${body.esquadrao_id}`)
      .lte('data_inicio', body.data_fim)
      .gte('data_fim', body.data_inicio);

    // 3. Buscar aulas já alocadas (para evitar conflitos)
    const { data: aulasExistentes } = await supabase
      .from('programacao_aulas')
      .select('data, horario_inicio, docente_id, local_id')
      .eq('turma_id', body.esquadrao_id)
      .gte('data', body.data_inicio)
      .lte('data', body.data_fim)
      .neq('status', 'cancelada');

    // 4. Lógica de alocação
    const alocacoes = alocarDisciplinas(
      disciplinas,
      bloqueios,
      aulasExistentes,
      body.data_inicio,
      body.data_fim
    );

    // 5. Verificar conflitos antes de gravar
    const conflitos = verificarConflitos(alocacoes, aulasExistentes);
    if (conflitos.length > 0) {
      return Response.json({ success: false, conflitos }, { status: 422 });
    }

    // 6. Gravar no banco
    if (body.substituir_existente) {
      await supabase
        .from('programacao_aulas')
        .delete()
        .eq('turma_id', body.esquadrao_id)
        .gte('data', body.data_inicio)
        .lte('data', body.data_fim);
    }

    const { data: inseridas, error } = await supabase
      .from('programacao_aulas')
      .insert(alocacoes)
      .select('id');

    if (error) throw error;

    return Response.json({
      success: true,
      aulas_criadas: inseridas.length,
      alocacoes
    });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});

// Algoritmo de alocação — adaptar conforme regras da AFA
function alocarDisciplinas(disciplinas, bloqueios, existentes, dataInicio, dataFim) {
  const alocacoes = [];
  const diasBloqueados = new Set(
    bloqueios.flatMap(b => getDatesInRange(b.data_inicio, b.data_fim))
  );

  const HORARIOS = ['07:00', '08:10', '09:30', '10:40', '13:20', '14:30', '15:50', '16:50'];
  const DURACAO = 60; // minutos

  for (const disc of disciplinas) {
    const criterio = disc.disciplina_criterios?.[0];
    if (!criterio) continue;

    const freqSemanal = criterio.freq_semanal || 2;
    const aulasPorSemana = freqSemanal;
    const docente = disc.docente_disciplinas?.[0]?.docente_id;

    let dataAtual = new Date(dataInicio);
    while (dataAtual <= new Date(dataFim)) {
      if (!diasBloqueados.has(dataAtual.toISOString().split('T')[0])) {
        for (const horario of HORARIOS) {
          const slot = {
            data: dataAtual.toISOString().split('T')[0],
            horario_inicio: horario + ':00',
            horario_fim: addMinutes(horario, DURACAO) + ':00',
            turma_id: disc.turma_id,
            disciplina_id: disc.id,
            docente_id: docente || null,
            local_id: criterio.local_padrao_id || null,
            status: 'confirmada'
          };

          if (!temConflito(slot, existentes.concat(alocacoes))) {
            alocacoes.push(slot);
            break;
          }
        }
      }
      dataAtual.setDate(dataAtual.getDate() + 1);
    }
  }

  return alocacoes;
}

function temConflito(slot, existentes) {
  return existentes.some(e =>
    e.data === slot.data &&
    e.horario_inicio === slot.horario_inicio &&
    (e.docente_id === slot.docente_id || e.local_id === slot.local_id)
  );
}

function verificarConflitos(novas, existentes) {
  return novas.filter(n => temConflito(n, existentes));
}

function getDatesInRange(start, end) {
  const dates = [];
  let d = new Date(start);
  while (d <= new Date(end)) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
```

### Deploy da Edge Function

```bash
supabase functions deploy run-automation --no-verify-jwt
```

---

## Edge Function 2: Verificação de Conflitos

```typescript
// supabase/functions/check-conflicts/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { data_inicio, data_fim, turma_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: conflitos, error } = await supabase
    .rpc('detectar_conflitos', {
      p_data_inicio: data_inicio,
      p_data_fim: data_fim,
      p_turma_id: turma_id || null
    });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    total: conflitos.length,
    conflitos
  });
});
```

---

## Realtime: SAP em Tempo Real

Substituir o listener Firebase na tela de Alterações (SAP).

### No frontend React:

```typescript
// hooks/useSAPRealtime.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSAPRealtime() {
  const [saPs, setSAPs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carregar SAPs iniciais
    supabase
      .from('solicitacoes_sap')
      .select(`
        *,
        programacao_aulas (
          data, horario_inicio, horario_fim,
          disciplinas (sigla, nome),
          docentes (trigrama, nome_guerra)
        )
      `)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSAPs(data || []);
        setLoading(false);
      });

    // Subscrever ao Realtime para atualizações ao vivo
    // (sem precisar dar F5 quando um Major cria uma SAP)
    const channel = supabase
      .channel('sap-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_sap' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSAPs(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSAPs(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
          } else if (payload.eventType === 'DELETE') {
            setSAPs(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { saPs, loading };
}
```

### Ativar Realtime no Supabase Dashboard:
1. Ir em **Database → Replication**
2. Habilitar `solicitacoes_sap` na lista de tabelas com Realtime
3. Ou via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE solicitacoes_sap;`

---

## Realtime: Avisos na tela Início

```typescript
// hooks/useAvisosRealtime.ts
const channel = supabase
  .channel('avisos-live')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'avisos',
      filter: `publico_alvo=cs.{${userRole}}`  // apenas avisos para o meu role
    },
    (payload) => {
      setAvisos(prev => [payload.new, ...prev]);
      // Disparar notificação push/toast
      notification.info({ message: payload.new.titulo });
    }
  )
  .subscribe();
```

---

## Stored Procedure: Trigger de Validação (BEFORE INSERT)

Rejeita no banco qualquer aula que cause conflito, independente do cliente:

```sql
-- Trigger que roda ANTES de qualquer INSERT em programacao_aulas
CREATE OR REPLACE FUNCTION validate_aula_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  conflito_docente text;
  conflito_local   text;
BEGIN
  -- Verificar conflito de docente
  IF NEW.docente_id IS NOT NULL THEN
    SELECT dc.nome_guerra INTO conflito_docente
    FROM programacao_aulas a
    JOIN docentes dc ON dc.id = a.docente_id
    WHERE a.docente_id = NEW.docente_id
      AND a.data = NEW.data
      AND a.horario_inicio = NEW.horario_inicio
      AND a.status != 'cancelada'
      AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'CONFLITO_DOCENTE: % já tem aula neste horário', conflito_docente;
    END IF;
  END IF;

  -- Verificar conflito de local
  IF NEW.local_id IS NOT NULL THEN
    SELECT l.nome INTO conflito_local
    FROM programacao_aulas a
    JOIN locais l ON l.id = a.local_id
    WHERE a.local_id = NEW.local_id
      AND a.data = NEW.data
      AND a.horario_inicio = NEW.horario_inicio
      AND a.status != 'cancelada'
      AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'CONFLITO_LOCAL: % já está ocupado neste horário', conflito_local;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_aula
  BEFORE INSERT OR UPDATE ON programacao_aulas
  FOR EACH ROW EXECUTE FUNCTION validate_aula_before_insert();
```

**No frontend**, tratar o erro do trigger:

```typescript
const { error } = await supabase.from('programacao_aulas').insert(novaAula);

if (error?.message?.includes('CONFLITO_DOCENTE')) {
  message.error(`Conflito: ${error.message.split(': ')[1]}`);
} else if (error?.message?.includes('CONFLITO_LOCAL')) {
  message.error(`Local ocupado: ${error.message.split(': ')[1]}`);
}
```
