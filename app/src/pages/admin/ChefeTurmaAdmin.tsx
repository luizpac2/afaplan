import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import type { Cadet, CadetAlocacao, Cohort, ChefeTurma } from '../../types';
import {
  UserCheck, Plus, Trash2, ChevronDown, AlertCircle, Check, Calendar,
} from 'lucide-react';

const TURMAS_AULA = ['TURMA_A', 'TURMA_B', 'TURMA_C', 'TURMA_D', 'TURMA_E', 'TURMA_F'];

// Calcula segunda e domingo da semana que contém uma data
const weekOf = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  const seg = new Date(d); seg.setDate(d.getDate() + diff);
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  return {
    inicio: seg.toISOString().slice(0, 10),
    fim:    dom.toISOString().slice(0, 10),
  };
};

const ANO = new Date().getFullYear();

export const ChefeTurmaAdmin = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [cadetes, setCadetes]   = useState<Cadet[]>([]);
  const [alocacoes, setAlocacoes] = useState<CadetAlocacao[]>([]);
  const [cohorts, setCohorts]   = useState<Cohort[]>([]);
  const [chefes, setChefes]     = useState<(ChefeTurma & { nome_guerra?: string })[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form
  const semanaAtual = weekOf(new Date());
  const [formTurma,  setFormTurma]  = useState('TURMA_A');
  const [formCadet,  setFormCadet]  = useState('');
  const [formInicio, setFormInicio] = useState(semanaAtual.inicio);
  const [formFim,    setFormFim]    = useState(semanaAtual.fim);

  const load = async () => {
    setLoading(true);
    const [
      { data: c }, { data: a }, { data: co }, { data: ch }
    ] = await Promise.all([
      supabase.from('cadetes').select('*').eq('situacao', 'ATIVO').order('nome_guerra'),
      supabase.from('cadete_alocacoes').select('*').eq('ano', ANO),
      supabase.from('cohorts').select('*'),
      supabase.from('chefes_turma').select('*, cadetes(nome_guerra, nome_completo)').order('data_inicio', { ascending: false }),
    ]);
    setCadetes((c as Cadet[]) ?? []);
    setAlocacoes((a as CadetAlocacao[]) ?? []);
    setCohorts((co as Cohort[]) ?? []);

    const chefesRaw = ((ch ?? []) as unknown[]).map((row) => {
      const r = row as ChefeTurma & { cadetes?: { nome_guerra?: string; nome_completo?: string } };
      return {
        ...r,
        nome_guerra: r.cadetes?.nome_guerra,
      };
    });
    setChefes(chefesRaw);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Cadetes da turma selecionada
  const cadetesDaTurma = useMemo(() => {
    const ids = alocacoes
      .filter((a) => a.turma_aula === formTurma)
      .map((a) => a.cadet_id);
    return cadetes.filter((c) => ids.includes(c.id));
  }, [cadetes, alocacoes, formTurma]);

  // Ao mudar turma, resetar cadete selecionado
  useEffect(() => { setFormCadet(''); }, [formTurma]);

  // Ao mudar data inicio, ajusta fim para o domingo correspondente
  const handleInicioChange = (val: string) => {
    setFormInicio(val);
    const d = new Date(val + 'T12:00:00');
    const w = weekOf(d);
    setFormInicio(w.inicio);
    setFormFim(w.fim);
  };

  const cohortMap = useMemo(() =>
    Object.fromEntries(cohorts.map((co) => [co.id, co])), [cohorts]);

  const handleNomear = async () => {
    if (!formCadet) { setMsg({ text: 'Selecione um cadete.', type: 'error' }); return; }
    const cadet = cadetes.find((c) => c.id === formCadet);
    if (!cadet) return;
    setSaving(true);
    setMsg(null);

    // Desativa nomeação anterior da mesma turma no mesmo período
    await supabase
      .from('chefes_turma')
      .update({ ativo: false })
      .eq('turma_aula', formTurma)
      .eq('ativo', true)
      .lte('data_inicio', formFim)
      .gte('data_fim', formInicio);

    const { error } = await supabase.from('chefes_turma').insert({
      cadet_id:    formCadet,
      turma_aula:  formTurma,
      cohort_id:   cadet.cohort_id,
      data_inicio: formInicio,
      data_fim:    formFim,
      ativo:       true,
    });

    if (error) setMsg({ text: error.message, type: 'error' });
    else {
      setMsg({ text: 'Chefe de Turma nomeado com sucesso!', type: 'success' });
      void load();
    }
    setSaving(false);
  };

  const handleRevogar = async (id: string) => {
    if (!confirm('Revogar esta nomeação?')) return;
    await supabase.from('chefes_turma').update({ ativo: false }).eq('id', id);
    void load();
  };

  // ── Estilos ──────────────────────────────────────────────
  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const lbl  = dark ? 'text-slate-400' : 'text-slate-500';
  const text = dark ? 'text-slate-100' : 'text-slate-900';
  const sel  = `appearance-none w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 pr-8 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`;

  const hoje = new Date().toISOString().slice(0, 10);
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className={`text-2xl tracking-tight ${text}`}>Chefes de Turma</h1>
        <p className={`mt-1 text-sm ${lbl}`}>Nomear cadetes para a função de Chefe de Turma por semana</p>
      </div>

      {/* Formulário de nomeação */}
      <div className={`${card}`}>
        <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${lbl}`}>
          <UserCheck size={14} className="inline mr-1" />
          Nova Nomeação
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Turma de aula */}
          <div>
            <label className={`text-xs ${lbl} block mb-1`}>Turma de Aula</label>
            <div className="relative">
              <select value={formTurma} onChange={(e) => setFormTurma(e.target.value)} className={sel}>
                {TURMAS_AULA.map((t) => (
                  <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>
                ))}
              </select>
              <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
            </div>
          </div>

          {/* Cadete */}
          <div>
            <label className={`text-xs ${lbl} block mb-1`}>Cadete</label>
            <div className="relative">
              <select value={formCadet} onChange={(e) => setFormCadet(e.target.value)} className={sel}>
                <option value="">— selecione —</option>
                {cadetesDaTurma.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_guerra} ({c.id})
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
            </div>
            {cadetesDaTurma.length === 0 && (
              <p className={`text-xs mt-1 ${lbl}`}>Nenhum cadete alocado nesta turma em {ANO}.</p>
            )}
          </div>

          {/* Período */}
          <div>
            <label className={`text-xs ${lbl} block mb-1`}>Semana (início)</label>
            <input
              type="date"
              value={formInicio}
              onChange={(e) => handleInicioChange(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
            />
          </div>
          <div>
            <label className={`text-xs ${lbl} block mb-1`}>Fim da semana</label>
            <input
              type="date"
              value={formFim}
              readOnly
              className={`w-full px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={handleNomear}
            disabled={saving || !formCadet}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Plus size={14} />}
            Nomear
          </button>
          {msg && (
            <span className={`flex items-center gap-1.5 text-sm ${msg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {msg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Listagem de nomeações */}
      <div className={card}>
        <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${lbl}`}>
          <Calendar size={14} className="inline mr-1" />
          Histórico de Nomeações
        </h2>

        {chefes.length === 0 ? (
          <p className={`text-sm ${lbl}`}>Nenhuma nomeação registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs uppercase tracking-wide ${lbl} border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className="text-left py-2 px-3">Cadete</th>
                  <th className="text-left py-2 px-3">Turma</th>
                  <th className="text-left py-2 px-3">Esquadrão</th>
                  <th className="text-left py-2 px-3">Período</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="py-2 px-3 w-12" />
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                {chefes.map((ch) => {
                  const ativo = ch.ativo && ch.data_inicio <= hoje && ch.data_fim >= hoje;
                  const futuro = ch.ativo && ch.data_inicio > hoje;
                  const cohort = cohortMap[ch.cohort_id];
                  return (
                    <tr key={ch.id} className={dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className={`py-2 px-3 font-medium ${text}`}>
                        {ch.nome_guerra ?? ch.cadet_id}
                        <span className={`ml-2 text-xs ${lbl}`}>{ch.cadet_id}</span>
                      </td>
                      <td className={`py-2 px-3 ${lbl}`}>{ch.turma_aula.replace('TURMA_', 'Turma ')}</td>
                      <td className={`py-2 px-3 ${lbl}`}>{cohort?.name ?? ch.cohort_id}</td>
                      <td className={`py-2 px-3 ${lbl}`}>
                        {fmtDate(ch.data_inicio)} – {fmtDate(ch.data_fim)}
                      </td>
                      <td className="py-2 px-3">
                        {ativo ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            Ativo agora
                          </span>
                        ) : futuro ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Futuro
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                            {ch.ativo ? 'Agendado' : 'Revogado'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {ch.ativo && (
                          <button
                            onClick={() => handleRevogar(ch.id)}
                            className={`p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
                            title="Revogar"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instrução autenticação cadetes */}
      <div className={`${card} p-5 border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10`}>
        <h3 className={`text-sm font-semibold mb-2 text-amber-800 dark:text-amber-400`}>
          Autenticação de Cadetes
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          Para que um cadete possa logar no sistema, crie o usuário no painel do Supabase
          em <strong>Authentication → Users → Invite User</strong> com o email institucional do cadete.
          Em seguida, acesse <strong>Gerenciar Usuários</strong> neste sistema e vincule o usuário
          ao cadete preenchendo <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">cadet_id</code> e{' '}
          <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">turma_aula</code> na tabela{' '}
          <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">user_roles</code>.
          O cadete receberá um email de convite para definir sua senha.
        </p>
      </div>
    </div>
  );
};
