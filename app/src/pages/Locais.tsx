import { useState, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import type { InstructionLocation, LocationIssue, LocationType, IssueSeverity, IssueStatus } from "../types";

// ── constants ────────────────────────────────────────────────────────────────

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "SALA",         label: "Sala de Aula" },
  { value: "AUDITORIO",    label: "Auditório" },
  { value: "LABORATORIO",  label: "Laboratório" },
  { value: "GINASIO",      label: "Ginásio / Área Esportiva" },
  { value: "AREA_EXTERNA", label: "Área Externa" },
  { value: "OUTRO",        label: "Outro" },
];

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  BAIXA:   "Baixa",
  MEDIA:   "Média",
  ALTA:    "Alta",
  CRITICA: "Crítica",
};

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  BAIXA:   "bg-blue-500/20 text-blue-400 border-blue-700",
  MEDIA:   "bg-amber-500/20 text-amber-400 border-amber-700",
  ALTA:    "bg-orange-500/20 text-orange-400 border-orange-700",
  CRITICA: "bg-red-500/20 text-red-400 border-red-700",
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  ABERTA:       "Aberta",
  EM_ANDAMENTO: "Em Andamento",
  RESOLVIDA:    "Resolvida",
};

const COMMON_EQUIPMENT = [
  "Projetor", "TV/Monitor", "Ar condicionado", "Quadro branco",
  "Quadro negro", "Som", "Microfone", "Computador", "Wi-Fi",
];

const emptyLocation = (): Omit<InstructionLocation, "id" | "createdAt"> => ({
  name: "",
  type: "SALA",
  capacity: 30,
  equipment: [],
  status: "ATIVO",
  notes: "",
  observationLog: [],
});

// ── helpers ──────────────────────────────────────────────────────────────────

function typeLabel(t: LocationType) {
  return LOCATION_TYPES.find((x) => x.value === t)?.label ?? t;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Locais() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const {
    locations, locationIssues,
    addLocation, updateLocation, deleteLocation,
    addLocationIssue, updateLocationIssue, deleteLocationIssue,
  } = useCourseStore();

  // ── state ──────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<InstructionLocation> & { isNew?: boolean } | null>(null);
  const [editingIssue, setEditingIssue] = useState<Partial<LocationIssue> & { isNew?: boolean } | null>(null);
  const [filterStatus, setFilterStatus] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [filterType, setFilterType]     = useState<LocationType | "TODOS">("TODOS");
  const [isSaving, setIsSaving]         = useState(false);
  const [search, setSearch]             = useState("");

  const selected = useMemo(() => locations.find((l) => l.id === selectedId) ?? null, [locations, selectedId]);

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (filterStatus !== "TODOS" && l.status !== filterStatus) return false;
      if (filterType !== "TODOS" && l.type !== filterType) return false;
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [locations, filterStatus, filterType, search]);

  const locationIssuesFor = useMemo(
    () => locationIssues.filter((i) => i.locationId === selectedId),
    [locationIssues, selectedId],
  );

  const openIssues = useMemo(
    () => locationIssues.filter((i) => i.status !== "RESOLVIDA"),
    [locationIssues],
  );

  // ── style helpers ──────────────────────────────────────────────────────────
  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const input  = isDark
    ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400"
    : "bg-white border-slate-300 text-slate-900 placeholder-slate-400";
  const label  = isDark ? "text-slate-300" : "text-slate-600";
  const text   = isDark ? "text-slate-100" : "text-slate-900";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";

  // ── save / delete handlers ─────────────────────────────────────────────────
  const handleSaveLocation = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { alert("Informe o nome do local."); return; }
    setIsSaving(true);
    try {
      if (editing.isNew) {
        const loc: InstructionLocation = {
          ...(emptyLocation()),
          ...editing,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        await addLocation(loc);
        setSelectedId(loc.id);
      } else {
        await updateLocation(editing.id!, editing);
      }
      setEditing(null);
    } catch (e: any) {
      alert("Erro ao salvar local: " + (e?.message ?? ""));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm("Excluir este local permanentemente?")) return;
    await deleteLocation(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleSaveIssue = async () => {
    if (!editingIssue || !selectedId) return;
    if (!editingIssue.description?.trim()) { alert("Informe a descrição do problema."); return; }
    setIsSaving(true);
    try {
      if (editingIssue.isNew) {
        await addLocationIssue({
          locationId:  selectedId,
          date:        editingIssue.date ?? new Date().toISOString().slice(0, 10),
          description: editingIssue.description!,
          severity:    (editingIssue.severity ?? "MEDIA") as IssueSeverity,
          status:      "ABERTA",
          resolution:  "",
        });
      } else {
        await updateLocationIssue(editingIssue.id!, editingIssue);
      }
      setEditingIssue(null);
    } catch (e: any) {
      alert("Erro ao salvar ocorrência: " + (e?.message ?? ""));
    } finally {
      setIsSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen p-4 md:p-6 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Locais de Instrução</h1>
          <p className={`text-sm ${muted}`}>{locations.length} locais cadastrados · {openIssues.length} pane(s) aberta(s)</p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyLocation(), isNew: true })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Novo Local
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── LEFT: lista ──────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3">

          {/* Filtros */}
          <div className={`flex flex-col gap-2 p-3 rounded-xl border ${card}`}>
            <input
              type="text"
              placeholder="Buscar local..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full px-3 py-1.5 text-sm rounded-lg border ${input}`}
            />
            <div className="flex gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${input}`}>
                <option value="TODOS">Todos</option>
                <option value="ATIVO">Ativos</option>
                <option value="INATIVO">Inativos</option>
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${input}`}>
                <option value="TODOS">Todos tipos</option>
                {LOCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[70vh]">
            {filtered.length === 0 && (
              <p className={`text-sm text-center py-8 ${muted}`}>Nenhum local encontrado.</p>
            )}
            {filtered.map((loc) => {
              const issues = locationIssues.filter((i) => i.locationId === loc.id && i.status !== "RESOLVIDA");
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelectedId(loc.id === selectedId ? null : loc.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedId === loc.id
                      ? "border-blue-500 ring-1 ring-blue-500 " + (isDark ? "bg-blue-900/20" : "bg-blue-50")
                      : card
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${text}`}>{loc.name}</p>
                      <p className={`text-xs ${muted}`}>{typeLabel(loc.type)} · {loc.capacity} lugares</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {issues.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-700">
                          ⚠ {issues.length}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                        loc.status === "ATIVO"
                          ? "bg-green-500/20 text-green-400 border-green-700"
                          : "bg-slate-500/20 text-slate-400 border-slate-600"
                      }`}>
                        {loc.status === "ATIVO" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                  {loc.equipment.length > 0 && (
                    <p className={`text-[10px] mt-1 truncate ${muted}`}>{loc.equipment.join(" · ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: detalhe ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4">
          {!selected && !editing && (
            <div className={`flex-1 flex items-center justify-center rounded-xl border ${card} min-h-64`}>
              <p className={`text-sm ${muted}`}>Selecione um local ou crie um novo</p>
            </div>
          )}

          {selected && !editing && (
            <>
              {/* Info card */}
              <div className={`rounded-xl border p-4 ${card}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className={`text-lg font-bold ${text}`}>{selected.name}</h2>
                    <p className={`text-sm ${muted}`}>{typeLabel(selected.type)} · {selected.capacity} lugares</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing({ ...selected })}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-600 text-blue-400 hover:bg-blue-900/30 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(selected.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-700 text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${muted}`}>Status</p>
                    <p className={`text-sm font-medium ${text}`}>{selected.status === "ATIVO" ? "Ativo" : "Inativo"}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${muted}`}>Capacidade</p>
                    <p className={`text-sm font-medium ${text}`}>{selected.capacity} pessoas</p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${muted}`}>Equipamentos</p>
                    <p className={`text-sm font-medium ${text}`}>{selected.equipment.length > 0 ? selected.equipment.join(", ") : "—"}</p>
                  </div>
                </div>

                {selected.notes && (
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${muted} mb-1`}>Observações</p>
                    <p className={`text-sm ${text}`}>{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* Panes */}
              <div className={`rounded-xl border p-4 ${card}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold text-sm ${text}`}>Panes / Problemas</h3>
                  <button
                    onClick={() => setEditingIssue({
                      isNew: true,
                      locationId: selected.id,
                      date: new Date().toISOString().slice(0, 10),
                      severity: "MEDIA",
                      status: "ABERTA",
                    })}
                    className="px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    + Reportar Pane
                  </button>
                </div>

                {locationIssuesFor.length === 0 && (
                  <p className={`text-xs text-center py-4 ${muted}`}>Nenhuma ocorrência registrada.</p>
                )}

                <div className="flex flex-col gap-2">
                  {locationIssuesFor.map((issue) => (
                    <div key={issue.id} className={`p-3 rounded-lg border ${isDark ? "border-slate-700 bg-slate-700/30" : "border-slate-100 bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${SEVERITY_COLORS[issue.severity]}`}>
                              {SEVERITY_LABELS[issue.severity]}
                            </span>
                            <span className={`text-[10px] ${muted}`}>{issue.date}</span>
                            <span className={`text-[10px] font-medium ${
                              issue.status === "RESOLVIDA" ? "text-green-400" :
                              issue.status === "EM_ANDAMENTO" ? "text-amber-400" : "text-red-400"
                            }`}>
                              {STATUS_LABELS[issue.status]}
                            </span>
                          </div>
                          <p className={`text-xs ${text}`}>{issue.description}</p>
                          {issue.resolution && (
                            <p className={`text-xs mt-1 ${muted}`}>↳ {issue.resolution}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingIssue({ ...issue })}
                            className={`p-1 text-xs rounded border ${isDark ? "border-slate-600 text-slate-400 hover:text-blue-400" : "border-slate-300 text-slate-500 hover:text-blue-600"}`}
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => deleteLocationIssue(issue.id)}
                            className={`p-1 text-xs rounded border ${isDark ? "border-slate-600 text-slate-400 hover:text-red-400" : "border-slate-300 text-slate-500 hover:text-red-600"}`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: editar local ──────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 ${card}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-lg font-bold mb-4 ${text}`}>
              {editing.isNew ? "Novo Local de Instrução" : "Editar Local"}
            </h2>

            <div className="flex flex-col gap-3">
              {/* Nome */}
              <div>
                <label className={`text-xs font-semibold ${label}`}>Nome *</label>
                <input
                  type="text"
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))}
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                  placeholder="Ex: Sala 204"
                />
              </div>

              {/* Tipo + Capacidade */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={`text-xs font-semibold ${label}`}>Tipo</label>
                  <select
                    value={editing.type ?? "SALA"}
                    onChange={(e) => setEditing((p) => ({ ...p!, type: e.target.value as LocationType }))}
                    className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                  >
                    {LOCATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className={`text-xs font-semibold ${label}`}>Capacidade</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.capacity ?? 30}
                    onChange={(e) => setEditing((p) => ({ ...p!, capacity: parseInt(e.target.value) || 0 }))}
                    className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className={`text-xs font-semibold ${label}`}>Status</label>
                <div className="flex gap-3 mt-1">
                  {(["ATIVO", "INATIVO"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={(editing.status ?? "ATIVO") === s}
                        onChange={() => setEditing((p) => ({ ...p!, status: s }))}
                      />
                      <span className={`text-sm ${text}`}>{s === "ATIVO" ? "Ativo" : "Inativo"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Equipamentos */}
              <div>
                <label className={`text-xs font-semibold ${label}`}>Equipamentos</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COMMON_EQUIPMENT.map((eq) => {
                    const checked = (editing.equipment ?? []).includes(eq);
                    return (
                      <label key={eq} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "bg-blue-600/20 border-blue-600 text-blue-400"
                          : isDark ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-600"
                      }`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => setEditing((p) => ({
                            ...p!,
                            equipment: checked
                              ? (p!.equipment ?? []).filter((x) => x !== eq)
                              : [...(p!.equipment ?? []), eq],
                          }))}
                        />
                        {eq}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className={`text-xs font-semibold ${label}`}>Observações</label>
                <textarea
                  rows={2}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, notes: e.target.value }))}
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input} resize-none`}
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className={`px-4 py-2 text-sm rounded-lg border ${isDark ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}>
                Cancelar
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: pane/problema ─────────────────────────────────────────── */}
      {editingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingIssue(null)}>
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${card}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-lg font-bold mb-4 ${text}`}>
              {editingIssue.isNew ? "Reportar Pane / Problema" : "Editar Ocorrência"}
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className={`text-xs font-semibold ${label}`}>Data</label>
                <input
                  type="date"
                  value={editingIssue.date ?? ""}
                  onChange={(e) => setEditingIssue((p) => ({ ...p!, date: e.target.value }))}
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold ${label}`}>Descrição *</label>
                <textarea
                  rows={3}
                  value={editingIssue.description ?? ""}
                  onChange={(e) => setEditingIssue((p) => ({ ...p!, description: e.target.value }))}
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input} resize-none`}
                  placeholder="Descreva o problema..."
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={`text-xs font-semibold ${label}`}>Gravidade</label>
                  <select
                    value={editingIssue.severity ?? "MEDIA"}
                    onChange={(e) => setEditingIssue((p) => ({ ...p!, severity: e.target.value as IssueSeverity }))}
                    className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                  >
                    {(Object.keys(SEVERITY_LABELS) as IssueSeverity[]).map((s) => (
                      <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`text-xs font-semibold ${label}`}>Status</label>
                  <select
                    value={editingIssue.status ?? "ABERTA"}
                    onChange={(e) => setEditingIssue((p) => ({ ...p!, status: e.target.value as IssueStatus }))}
                    className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                  >
                    {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingIssue.status === "RESOLVIDA" && (
                <div>
                  <label className={`text-xs font-semibold ${label}`}>Resolução</label>
                  <textarea
                    rows={2}
                    value={editingIssue.resolution ?? ""}
                    onChange={(e) => setEditingIssue((p) => ({ ...p!, resolution: e.target.value }))}
                    className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input} resize-none`}
                    placeholder="Como foi resolvido..."
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingIssue(null)} className={`px-4 py-2 text-sm rounded-lg border ${isDark ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}>
                Cancelar
              </button>
              <button
                onClick={handleSaveIssue}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
