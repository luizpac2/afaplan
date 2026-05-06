import { useState } from "react";
import { Plus, Edit, Trash2, Save, X, Mail, User } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useCourseStore } from "../../store/useCourseStore";
import { supabase } from "../../config/supabase";
import { invalidateCache } from "../../services/supabaseService";
import type { DisciplineArea, TrainingField } from "../../types";

const FIELD_OPTIONS: { value: TrainingField | ""; label: string }[] = [
  { value: "", label: "— Nenhum —" },
  { value: "GERAL", label: "Geral" },
  { value: "MILITAR", label: "Militar" },
  { value: "PROFISSIONAL", label: "Profissional" },
  { value: "ATIVIDADES_COMPLEMENTARES", label: "Ativ. Complementares" },
];

const FIELD_COLOR: Record<string, string> = {
  GERAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  MILITAR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  PROFISSIONAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ATIVIDADES_COMPLEMENTARES: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const emptyArea = (): Omit<DisciplineArea, "id"> & { id: string } => ({
  id: "",
  name: "",
  code: "",
  trainingField: undefined,
  coordinatorName: "",
  coordinatorEmail: "",
  coordinatorUserId: undefined,
});

export const DisciplineAreaManager = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { disciplineAreas, disciplines, upsertDisciplineArea, deleteDisciplineArea } = useCourseStore();

  const [editing, setEditing] = useState<(DisciplineArea & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...disciplineAreas].sort((a, b) => {
    const fa = a.trainingField ?? "ZZZ";
    const fb = b.trainingField ?? "ZZZ";
    return fa.localeCompare(fb) || a.name.localeCompare(b.name);
  });

  const discCount = (areaId: string) =>
    disciplines.filter((d) => (d as any).areaId === areaId).length;

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.id.trim()) { setError("ID é obrigatório (ex: EXATAS)"); return; }
    if (!editing.name.trim()) { setError("Nome é obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      const row: Record<string, unknown> = {
        id: editing.id.trim().toUpperCase(),
        name: editing.name.trim(),
        code: editing.code?.trim() || null,
        trainingField: editing.trainingField || null,
        coordinatorName: editing.coordinatorName?.trim() || null,
        coordinatorEmail: editing.coordinatorEmail?.trim() || null,
        coordinatorUserId: editing.coordinatorUserId || null,
      };
      const { error: e } = await supabase.functions.invoke("admin-manage-content", {
        body: { action: "upsert_area", area: row },
      });
      if (e) throw e;
      upsertDisciplineArea(row as unknown as DisciplineArea);
      invalidateCache("discipline_areas");
      setEditing(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta área? As disciplinas vinculadas perderão a associação.")) return;
    const { error: e } = await supabase.functions.invoke("admin-manage-content", {
      body: { action: "delete_area", id },
    });
    if (e) { alert(e.message); return; }
    deleteDisciplineArea(id);
    invalidateCache("discipline_areas");
  };

  const card = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const input = `w-full px-3 py-1.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/30 ${isDark ? "bg-slate-900 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            Áreas Acadêmicas
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Vincule disciplinas a áreas e coordenadores.
          </p>
        </div>
        <button
          onClick={() => setEditing(emptyArea())}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nova Área
        </button>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-xs uppercase tracking-wide ${isDark ? "bg-slate-700/50 text-slate-400" : "bg-slate-50 text-slate-500"}`}>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Área</th>
              <th className="px-4 py-3 text-left">Campo</th>
              <th className="px-4 py-3 text-left">Coordenador(a)</th>
              <th className="px-4 py-3 text-center">Disciplinas</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {sorted.map((area) => (
              <tr key={area.id} className={isDark ? "hover:bg-slate-750" : "hover:bg-slate-50/50"}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold text-blue-500">{area.code || area.id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={isDark ? "text-slate-100" : "text-slate-800"}>{area.name}</span>
                </td>
                <td className="px-4 py-3">
                  {area.trainingField && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${FIELD_COLOR[area.trainingField] ?? ""}`}>
                      {FIELD_OPTIONS.find((o) => o.value === area.trainingField)?.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {area.coordinatorName && (
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <User size={11} className="text-slate-400" /> {area.coordinatorName}
                      </span>
                      {area.coordinatorEmail && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Mail size={10} /> {area.coordinatorEmail}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold ${discCount(area.id) > 0 ? "text-blue-500" : "text-slate-400"}`}>
                    {discCount(area.id)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing({ ...area })} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(area.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                  Nenhuma área cadastrada. Clique em "Nova Área" ou execute a migration SQL.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border ${card}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}>
              <h2 className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {editing.id && disciplineAreas.some((a) => a.id === editing.id) ? "Editar Área" : "Nova Área"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>ID (sem espaços) *</label>
                  <input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                    className={input} placeholder="EXATAS" disabled={disciplineAreas.some((a) => a.id === editing.id)} />
                </div>
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Código (A1, TCC…)</label>
                  <input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    className={input} placeholder="A1" />
                </div>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Nome da Área *</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={input} placeholder="Ciências Exatas" />
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Campo</label>
                <select value={editing.trainingField ?? ""} onChange={(e) => setEditing({ ...editing, trainingField: (e.target.value as TrainingField) || undefined })}
                  className={input}>
                  {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Coordenador(a)</label>
                <input value={editing.coordinatorName ?? ""} onChange={(e) => setEditing({ ...editing, coordinatorName: e.target.value })}
                  className={input} placeholder="Prof. Alessandro" />
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>E-mail do Coordenador</label>
                <input type="email" value={editing.coordinatorEmail ?? ""} onChange={(e) => setEditing({ ...editing, coordinatorEmail: e.target.value })}
                  className={input} placeholder="email@exemplo.com" />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className={`px-5 py-4 border-t flex justify-end gap-2 ${isDark ? "border-slate-700" : "border-slate-100"}`}>
              <button onClick={() => setEditing(null)} className={`px-4 py-2 rounded-lg text-sm ${isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Cancelar
              </button>
              <button onClick={() => void handleSave()} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                <Save size={14} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
