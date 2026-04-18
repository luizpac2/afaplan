import { useState, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useDefaultRoomsMap } from "../hooks/useDefaultRoom";
import { CheckCircle } from "lucide-react";

// A–D: Aviação (D pode não existir); E: Intendência; F: Infantaria
const YEARS = [1, 2, 3, 4];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SalasPadrao() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { locations, visualConfigs, updateVisualConfig } = useCourseStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const salas = useMemo(
    () => locations.filter((l) => l.status === "ATIVO" && l.type === "SALA").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [locations],
  );

  const roomsMap = useDefaultRoomsMap(selectedYear);

  const handleChange = async (classId: string, locationId: string) => {
    setSaving(classId);
    const configId = `default_rooms_${selectedYear}`;
    const existing = visualConfigs.find((v) => v.id === configId);
    const newData = { ...(roomsMap ?? {}), [classId]: locationId || undefined };
    if (!locationId) delete newData[classId];

    await updateVisualConfig(configId, {
      ...(existing ?? {}),
      id: configId,
      name: `Salas Padrão ${selectedYear}`,
      data: newData,
    });

    setSaving(null);
    setSaved(classId);
    setTimeout(() => setSaved(null), 1500);
  };

  const text   = isDark ? "text-slate-100" : "text-slate-900";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const input  = isDark ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900";
  const header = isDark ? "bg-slate-700/50" : "bg-slate-50";
  const border = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <div className={`min-h-screen p-4 md:p-6 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Salas de Aula Padrão</h1>
          <p className={`text-sm ${muted}`}>
            Define o local padrão para cada turma de aula quando a aula ou disciplina não tem local explícito.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`text-sm font-semibold ${muted}`}>Ano letivo:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`px-3 py-2 text-sm rounded-lg border ${input}`}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {salas.length === 0 && (
        <div className={`flex items-center justify-center rounded-xl border min-h-40 ${card}`}>
          <p className={`text-sm ${muted}`}>
            Nenhuma sala de aula ativa cadastrada em Gestão de Locais.
          </p>
        </div>
      )}

      {salas.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${card}`}>
          {/* Cabeçalho da tabela */}
          <div className={`grid border-b ${border} ${header}`} style={{ gridTemplateColumns: "80px repeat(6, 1fr)" }}>
            <div className={`px-3 py-2 text-xs font-bold ${muted}`}>Esquadrão</div>
            {LETTERS.map((l) => (
              <div key={l} className={`px-2 py-2 text-xs font-bold text-center ${muted}`}>Turma {l}</div>
            ))}
          </div>

          {/* Linhas por ano de esquadrão */}
          {YEARS.map((yr) => (
            <div
              key={yr}
              className={`grid border-b last:border-b-0 ${border}`}
              style={{ gridTemplateColumns: "80px repeat(6, 1fr)" }}
            >
              <div className={`px-3 py-3 flex items-center font-bold text-sm ${text}`}>
                {yr}º Ano
              </div>
              {LETTERS.map((l) => {
                const classId = `${yr}${l}`;
                const locationId = roomsMap[classId] ?? "";
                const isSaving = saving === classId;
                const isSaved  = saved  === classId;
                return (
                  <div key={l} className={`px-2 py-2 border-l ${border} flex items-center gap-1`}>
                    <select
                      value={locationId}
                      onChange={(e) => handleChange(classId, e.target.value)}
                      disabled={isSaving}
                      className={`w-full px-2 py-1.5 text-xs rounded-lg border ${input} disabled:opacity-50`}
                    >
                      <option value="">— Sem padrão —</option>
                      {salas.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {isSaved && <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs mt-4 ${muted}`}>
        Configuração salva por ano letivo. Alterações em {selectedYear} não afetam outros anos.
      </p>
    </div>
  );
}
