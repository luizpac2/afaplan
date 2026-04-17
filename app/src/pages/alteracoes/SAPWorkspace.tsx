import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, GitBranch, Play, RotateCcw,
  Trash2, Plus, MoveRight, AlertTriangle, CheckCircle2, Loader2,
  FileEdit, Clock, PanelRightClose, PanelRight, Shield,
} from "lucide-react";
import { TIME_SLOTS } from "../../utils/constants";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCourseStore } from "../../store/useCourseStore";
import { subscribeToEventsByDateRange } from "../../services/supabaseService";
import {
  fetchSAPChanges,
  createSAPChange,
  revertSAPChange,
  deleteSAPChange,
  clearSAPChanges,
  applySAPToProduction,
  markSAPAsExecuted,
  applyChangesToEvents,
} from "../../services/sapService";
import type { SAPSimulationChange } from "../../services/sapService";
import type { ScheduleEvent, Discipline } from "../../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DAYS = ["SEG","TER","QUA","QUI","SEX","SÁB"];
const DAY_OFFSETS = [0,1,2,3,4,5];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 5);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${start.toLocaleDateString("pt-BR", opts)} – ${end.toLocaleDateString("pt-BR", opts)}`;
}

function slotEnd(slotStart: string): string {
  const slot = TIME_SLOTS.find((s) => s.start === slotStart);
  if (slot) return slot.end;
  // fallback: +1h
  const [h, m] = slotStart.split(":").map(Number);
  const total = h * 60 + (m ?? 0) + 60;
  return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
}

const ACTION_LABEL: Record<SAPSimulationChange["action"], string> = {
  MOVE:   "Movida",
  DELETE: "Removida",
  ADD:    "Adicionada",
  MODIFY: "Modificada",
};

const ACTION_COLOR: Record<SAPSimulationChange["action"], string> = {
  MOVE:   "amber",
  DELETE: "red",
  ADD:    "green",
  MODIFY: "blue",
};

// ---------------------------------------------------------------------------
// Add-event modal (simple)
// ---------------------------------------------------------------------------
interface AddEventModalProps {
  date: string;
  slotStart: string;
  disciplines: Discipline[];
  isDark: boolean;
  onConfirm: (disc: Discipline) => void;
  onCancel: () => void;
}

function AddEventModal({ date, slotStart, disciplines, isDark, onConfirm, onCancel }: AddEventModalProps) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<Discipline | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return disciplines.slice(0, 8);
    return disciplines.filter(
      (d) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query, disciplines]);

  const bg   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const item = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
      active
        ? "bg-green-600 text-white"
        : isDark ? "hover:bg-slate-700 text-slate-200" : "hover:bg-slate-100 text-slate-700"
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className={`rounded-2xl border shadow-xl p-4 w-80 ${bg}`} onClick={(e) => e.stopPropagation()}>
        <h3 className={`text-sm font-bold mb-0.5 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          Adicionar aula
        </h3>
        <p className={`text-xs mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {date} às {slotStart}
        </p>

        <input
          autoFocus
          type="text"
          placeholder="Buscar disciplina (código ou nome)..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          className={`w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 mb-2 ${isDark ? "bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400"}`}
        />

        <div className={`rounded-lg border overflow-hidden mb-3 max-h-48 overflow-y-auto ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          {filtered.length === 0 ? (
            <p className={`px-3 py-3 text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Nenhuma disciplina encontrada
            </p>
          ) : (
            <div className="p-1 space-y-0.5">
              {filtered.map((d) => (
                <div key={d.id} className={item(selected?.id === d.id)} onClick={() => setSelected(d)}>
                  <span className="font-bold w-14 flex-shrink-0" style={{ color: selected?.id === d.id ? "white" : d.color }}>
                    {d.code}
                  </span>
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            disabled={!selected}
            onClick={() => { if (selected) onConfirm(selected); }}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-green-700 transition-colors"
          >
            Adicionar
          </button>
          <button onClick={onCancel} className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"} transition-colors`}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const SAPWorkspace = () => {
  const { sapId } = useParams<{ sapId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const isDark = theme === "dark";

  const { changeRequests, disciplines, updateChangeRequest } = useCourseStore();

  // SAP being edited
  const sap = useMemo(
    () => changeRequests.find((r) => r.id === sapId) ?? null,
    [changeRequests, sapId],
  );

  // Navigation state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [squadron, setSquadron] = useState<1|2|3|4>(1);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [diffOpen, setDiffOpen] = useState(true);

  // Production events for the current week
  const [prodEvents, setProdEvents] = useState<ScheduleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Simulation changes
  const [changes, setChanges] = useState<SAPSimulationChange[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  // UI state
  const [addModal, setAddModal] = useState<{ date: string; slotStart: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: string[] } | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [saving, setSaving] = useState(false);

  const dragEventId = useRef<string | null>(null);

  // Load changes once on mount (per SAP)
  useEffect(() => {
    if (!sapId) return;
    setLoadingChanges(true);
    fetchSAPChanges(sapId)
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoadingChanges(false));
  }, [sapId]);

  // Load production events for current week
  useEffect(() => {
    setLoadingEvents(true);
    const weekEnd = toDateStr(addDays(weekStart, 5));
    const unsub = subscribeToEventsByDateRange(
      toDateStr(weekStart),
      weekEnd,
      (data) => {
        setProdEvents(data as ScheduleEvent[]);
        setLoadingEvents(false);
      },
    );
    return unsub;
  }, [weekStart]);

  // Compute simulated state
  const { events: simEvents, movedIds, deletedIds, addedIds } = useMemo(
    () => applyChangesToEvents(prodEvents, changes),
    [prodEvents, changes],
  );

  // Filter events for current view
  const visibleEvents = useMemo(() => {
    const weekEnd = toDateStr(addDays(weekStart, 5));
    return simEvents.filter((e) => {
      if (e.date < toDateStr(weekStart) || e.date > weekEnd) return false;
      if (e.type === "ACADEMIC" || e.type === "HOLIDAY") return true;
      const esq = Number(e.classId?.[0]);
      if (esq !== squadron) return false;
      if (selectedClass !== "ALL") {
        const cls = e.classId?.[1];
        if (cls && cls !== selectedClass) return false;
      }
      return true;
    });
  }, [simEvents, weekStart, squadron, selectedClass]);

  // Ghost events: deleted items still shown as red overlay
  const ghostEvents = useMemo(() => {
    return prodEvents.filter((e) => deletedIds.has(e.id)).map((e) => ({
      ...e,
      _ghost: true as const,
    }));
  }, [prodEvents, deletedIds]);

  // All visible events including ghosts
  const allVisible = useMemo(() => [
    ...visibleEvents.map((e) => ({ ...e, _ghost: false as const })),
    ...ghostEvents.filter((g) => {
      const weekEnd = toDateStr(addDays(weekStart, 5));
      return g.date >= toDateStr(weekStart) && g.date <= weekEnd &&
        Number(g.classId?.[0]) === squadron;
    }),
  ], [visibleEvents, ghostEvents, weekStart, squadron]);

  const disciplineMap = useMemo(() => {
    const m = new Map<string, Discipline>();
    disciplines.forEach((d) => m.set(d.id, d));
    return m;
  }, [disciplines]);

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------
  const handleDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("eventId", eventId);
    e.dataTransfer.effectAllowed = "move";
    dragEventId.current = eventId;
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, date: string, slotStart: string) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("eventId");
    if (!eventId || !sapId) return;

    const original = prodEvents.find((ev) => ev.id === eventId);
    if (!original) return;

    // Same slot — no change
    if (original.date === date && original.startTime === slotStart) return;

    const slotEndTime = slotEnd(slotStart);
    const newData: Partial<ScheduleEvent> = {
      ...original,
      date,
      startTime: slotStart,
      endTime: slotEndTime,
    };

    setSaving(true);
    try {
      // If already has a MOVE change for this event, remove it first and replace
      const existing = changes.find(
        (c) => c.eventId === eventId && c.action === "MOVE" && !c.reverted,
      );
      if (existing) {
        await deleteSAPChange(existing.id);
      }

      const newChange = await createSAPChange(
        sapId,
        "MOVE",
        eventId,
        { date: original.date, startTime: original.startTime, endTime: original.endTime, classId: original.classId },
        newData,
        userProfile?.uid,
      );

      setChanges((prev) => [
        ...prev.filter((c) => c.id !== existing?.id),
        newChange,
      ]);
    } catch (err) {
      console.error("Failed to save MOVE change:", err);
    } finally {
      setSaving(false);
    }
  }, [sapId, prodEvents, changes, userProfile]);

  const handleDeleteEvent = useCallback(async (event: ScheduleEvent) => {
    if (!sapId) return;
    if (!window.confirm(`Remover "${disciplineMap.get(event.disciplineId)?.code ?? event.disciplineId}" desta simulação?`)) return;

    // If it was an ADD, just remove the ADD change entirely
    const addChange = changes.find((c) => c.action === "ADD" && c.newData?.id === event.id && !c.reverted);
    if (addChange) {
      setSaving(true);
      await deleteSAPChange(addChange.id).catch(console.error);
      setChanges((prev) => prev.filter((c) => c.id !== addChange.id));
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const existing = changes.find((c) => c.eventId === event.id && c.action === "DELETE" && !c.reverted);
      if (!existing) {
        const newChange = await createSAPChange(
          sapId,
          "DELETE",
          event.id,
          { date: event.date, startTime: event.startTime, disciplineId: event.disciplineId, classId: event.classId },
          undefined,
          userProfile?.uid,
        );
        setChanges((prev) => [...prev, newChange]);
      }
    } catch (err) {
      console.error("Failed to save DELETE change:", err);
    } finally {
      setSaving(false);
    }
  }, [sapId, changes, disciplineMap, userProfile]);

  const handleAddEvent = useCallback(async (disc: Discipline) => {
    if (!addModal || !sapId) return;
    const classId = selectedClass === "ALL" ? `${squadron}A` : `${squadron}${selectedClass}`;
    const newEvent: ScheduleEvent = {
      id: crypto.randomUUID(),
      disciplineId: disc.id,
      classId,
      date: addModal.date,
      startTime: addModal.slotStart,
      endTime: slotEnd(addModal.slotStart),
      type: "CLASS",
      color: disc.color,
    };
    setSaving(true);
    try {
      const newChange = await createSAPChange(
        sapId,
        "ADD",
        undefined,
        undefined,
        newEvent,
        userProfile?.uid,
      );
      setChanges((prev) => [...prev, newChange]);
    } catch (err) {
      console.error("Failed to save ADD change:", err);
    } finally {
      setSaving(false);
      setAddModal(null);
    }
  }, [addModal, sapId, squadron, selectedClass, userProfile]);

  const handleRevertChange = useCallback(async (change: SAPSimulationChange) => {
    setSaving(true);
    try {
      await revertSAPChange(change.id, !change.reverted);
      setChanges((prev) => prev.map((c) => c.id === change.id ? { ...c, reverted: !c.reverted } : c));
    } catch (err) {
      console.error("Failed to revert change:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!sapId || !window.confirm("Desfazer TODAS as alterações desta simulação?")) return;
    setSaving(true);
    await clearSAPChanges(sapId).catch(console.error);
    setChanges([]);
    setSaving(false);
  }, [sapId]);

  const handleApply = useCallback(async () => {
    if (!sapId) return;
    setApplying(true);
    setConfirmApply(false);
    try {
      const result = await applySAPToProduction(sapId, changes);
      if (result.errors.length === 0) {
        await markSAPAsExecuted(sapId);
      }
      setApplyResult(result);
    } catch (err) {
      setApplyResult({ applied: 0, errors: [String(err)] });
    } finally {
      setApplying(false);
    }
  }, [sapId, changes]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const activeChanges = changes.filter((c) => !c.reverted);
  const canApply = sap?.status === "APROVADA" && activeChanges.length > 0 && !applying;

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!sap || !userProfile) return;
    await updateChangeRequest(sap.id, { status: newStatus as any }, userProfile.uid);
  }, [sap, userProfile, updateChangeRequest]);

  const bg       = isDark ? "bg-slate-950"    : "bg-slate-50";
  const cardBg   = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const headerBg = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";

  if (!sap) {
    return (
      <div className={`flex items-center justify-center h-64 ${bg}`}>
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-400 mb-2" />
          <p className={isDark ? "text-slate-400" : "text-slate-500"}>SAP não encontrada.</p>
          <Link to="/change-requests" className="text-amber-500 text-sm underline mt-2 block">Voltar para lista</Link>
        </div>
      </div>
    );
  }

  const STATUS_BG: Record<string, string> = {
    PENDENTE:  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    APROVADA:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REJEITADA: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    EXECUTADA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div className={`flex flex-col h-full min-h-screen ${bg}`}>
      {/* ─── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${headerBg} sticky top-0 z-30 flex-shrink-0`}>
        <Link to="/change-requests" className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}>
          <ArrowLeft size={18} />
        </Link>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <GitBranch size={16} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {sap.numeroAlteracao}
              </span>
              <select
                value={sap.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={sap.status === "EXECUTADA"}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer disabled:cursor-default ${STATUS_BG[sap.status] ?? ""}`}
              >
                <option value="PENDENTE">PENDENTE</option>
                <option value="APROVADA">APROVADA</option>
                <option value="REJEITADA">REJEITADA</option>
                <option value="EXECUTADA" disabled>EXECUTADA</option>
              </select>
              <span className={`hidden sm:inline text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {sap.motivo}
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Solicitante: {sap.solicitante} · {new Date(sap.dataSolicitacao).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <Loader2 size={14} className="animate-spin text-slate-400" />}

          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            {activeChanges.length} alteraç{activeChanges.length !== 1 ? "ões" : "ão"}
          </span>

          <button
            onClick={() => setDiffOpen((p) => !p)}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
            title={diffOpen ? "Fechar painel" : "Abrir painel"}
          >
            {diffOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>

          {sap.status !== "EXECUTADA" && (
            <button
              onClick={() => setConfirmApply(true)}
              disabled={!canApply}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
            >
              <Play size={13} />
              Aplicar à Produção
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Main Gantt Area ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {/* Controls row */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${cardBg} flex-wrap`}>
            {/* Squadron selector */}
            <div className="flex items-center gap-1">
              {([1,2,3,4] as const).map((sq) => (
                <button
                  key={sq}
                  onClick={() => setSquadron(sq)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    squadron === sq
                      ? "bg-amber-500 text-white"
                      : isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {sq}º Esq
                </button>
              ))}
            </div>

            {/* Class selector */}
            <div className="flex items-center gap-1">
              {["ALL","A","B","C","D","E","F"].map((cls) => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    selectedClass === cls
                      ? "bg-blue-500 text-white"
                      : isDark ? "bg-slate-800 text-slate-500 hover:bg-slate-700" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {cls === "ALL" ? "Todas" : `Turma ${cls}`}
                </button>
              ))}
            </div>

            {/* Week navigator */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className={`p-1.5 rounded-lg border transition-colors ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
              >
                <ChevronLeft size={14} />
              </button>
              <span className={`text-xs font-medium px-2 min-w-40 text-center ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {formatWeekLabel(weekStart)}
              </span>
              <button
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className={`p-1.5 rounded-lg border transition-colors ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setWeekStart(getWeekStart(new Date()))}
                className={`ml-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${isDark ? "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
              >
                Hoje
              </button>
            </div>

            {loadingEvents && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          {/* Simulation badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${isDark ? "bg-amber-900/20 border-amber-800 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            <GitBranch size={12} />
            Modo Simulação — arraste para mover aulas, clique com o botão direito para remover, clique em slot vazio para adicionar
          </div>

          {/* Gantt Grid */}
          <div className={`rounded-xl border overflow-hidden shadow-sm ${cardBg}`}>
            {/* Day headers */}
            <div className="grid grid-cols-[64px_repeat(6,1fr)] border-b">
              <div className={`py-2 ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`} />
              {DAYS.map((day, i) => {
                const d = addDays(weekStart, i);
                const isToday = toDateStr(d) === toDateStr(new Date());
                return (
                  <div
                    key={day}
                    className={`py-2 text-center border-l text-[11px] font-bold uppercase tracking-wide ${
                      isToday
                        ? isDark ? "bg-amber-900/30 border-slate-700 text-amber-400" : "bg-amber-50 border-slate-200 text-amber-600"
                        : isDark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    {day}
                    <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                      {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {TIME_SLOTS.map((slot) => (
              <div key={slot.start} className={`grid grid-cols-[64px_repeat(6,1fr)] border-b last:border-b-0 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                {/* Time label */}
                <div className={`flex items-start justify-end pr-2 pt-1 text-[10px] font-medium tabular-nums leading-tight ${isDark ? "text-slate-600 bg-slate-900" : "text-slate-400 bg-white"}`}>
                  {slot.start}
                </div>

                {/* Day cells */}
                {DAY_OFFSETS.map((offset) => {
                  const cellDate = toDateStr(addDays(weekStart, offset));
                  const cellEvents = allVisible.filter(
                    (e) => e.date === cellDate && e.startTime === slot.start,
                  );

                  return (
                    <div
                      key={offset}
                      className={`min-h-[52px] border-l p-1 relative transition-colors group ${
                        isDark
                          ? "border-slate-800 hover:bg-slate-800/40"
                          : "border-slate-100 hover:bg-blue-50/30"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(isDark ? "bg-amber-900/20" : "bg-amber-50"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove(isDark ? "bg-amber-900/20" : "bg-amber-50"); }}
                      onDrop={(e) => {
                        e.currentTarget.classList.remove(isDark ? "bg-amber-900/20" : "bg-amber-50");
                        handleDrop(e, cellDate, slot.start);
                      }}
                      onClick={() => {
                        const realEvents = cellEvents.filter((e) => !(e as any)._ghost);
                        if (realEvents.length === 0) {
                          setAddModal({ date: cellDate, slotStart: slot.start });
                        }
                      }}
                    >
                      {cellEvents.filter((e) => !(e as any)._ghost).length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Plus size={12} className={isDark ? "text-slate-600" : "text-slate-300"} />
                        </div>
                      )}

                      {cellEvents.map((ev) => {
                        const disc = disciplineMap.get(ev.disciplineId);
                        const isGhost  = (ev as any)._ghost;
                        const isMoved  = movedIds.has(ev.id);
                        const isAdded  = addedIds.has(ev.id);
                        const color    = disc?.color ?? ev.color ?? "#6366f1";

                        let borderStyle = `2px solid ${color}`;
                        let bgOpacity = "18";
                        let labelExtra = "";

                        if (isGhost) {
                          borderStyle = "2px dashed #ef4444";
                          bgOpacity = "10";
                          labelExtra = "line-through opacity-50";
                        } else if (isMoved) {
                          borderStyle = "2px solid #f59e0b";
                          bgOpacity = "20";
                        } else if (isAdded) {
                          borderStyle = "2px solid #22c55e";
                          bgOpacity = "20";
                        }

                        return (
                          <div
                            key={ev.id}
                            draggable={!isGhost}
                            onDragStart={(e) => handleDragStart(e, ev.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (!isGhost) handleDeleteEvent(ev);
                            }}
                            onClick={(e) => {
                              if (isGhost) {
                                e.stopPropagation();
                                setAddModal({ date: ev.date, slotStart: ev.startTime });
                              }
                            }}
                            title={isGhost
                              ? `Clique para adicionar uma aula no lugar de ${disc?.code ?? ev.disciplineId}`
                              : `${disc?.name ?? ev.disciplineId} · ${ev.startTime}–${ev.endTime}\nBotão direito para remover`}
                            className={`rounded px-1 py-0.5 mb-0.5 text-[10px] font-semibold select-none ${isGhost ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                            style={{
                              border: borderStyle,
                              backgroundColor: `${color}${bgOpacity}`,
                            }}
                          >
                            <div className={`flex items-center justify-between gap-1 ${labelExtra}`}>
                              <span style={{ color }} className="truncate">
                                {disc?.code ?? ev.disciplineId.slice(0, 6)}
                              </span>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {isGhost  && <span className="text-red-400 text-[8px] flex items-center gap-0.5">DEL <Plus size={7} /></span>}
                                {isMoved  && <span className="text-amber-500 text-[8px]">MOV</span>}
                                {isAdded  && <span className="text-green-500 text-[8px]">ADD</span>}
                                {(ev as any).changeRequestId && !isMoved && !isAdded && !isGhost && (
                                  <Shield size={7} className="text-purple-400" />
                                )}
                                {!isGhost && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev); }}
                                    className="opacity-0 group-hover:opacity-100 ml-0.5 hover:text-red-400 transition-opacity"
                                  >
                                    <Trash2 size={8} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className={`text-[9px] opacity-60 truncate ${labelExtra}`}>
                              {ev.classId}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className={`flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl border text-[11px] ${isDark ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-400/20 inline-block" /> Aula movida</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/20 inline-block" /> Aula adicionada</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-red-500 bg-red-500/10 inline-block" /> Aula removida</div>
            <div className="flex items-center gap-1.5"><Shield size={10} className="text-purple-400" /> Já alterada por SAP anterior</div>
            <span className="ml-auto opacity-70">Botão direito sobre a aula para remover</span>
          </div>
        </div>

        {/* ─── Diff Panel ───────────────────────────────────────────────────── */}
        {diffOpen && (
          <aside className={`w-72 flex-shrink-0 border-l ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} flex flex-col overflow-hidden`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center gap-2">
                <FileEdit size={14} className="text-amber-500" />
                <span className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  Alterações
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                  {activeChanges.length}
                </span>
              </div>
              {changes.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className={`text-[10px] flex items-center gap-1 ${isDark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}
                >
                  <RotateCcw size={10} />
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingChanges ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : changes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <GitBranch size={28} className={isDark ? "text-slate-700" : "text-slate-200"} />
                  <p className={`text-xs mt-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Nenhuma alteração ainda. Arraste as aulas no Gantt para simular mudanças.
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {changes.map((change) => {
                    const disc = disciplineMap.get(
                      change.originalData?.disciplineId ?? change.newData?.disciplineId ?? "",
                    );
                    const color = ACTION_COLOR[change.action];
                    const colorMap: Record<string, string> = {
                      amber: "border-amber-400 bg-amber-400/10",
                      red:   "border-red-400 bg-red-400/10",
                      green: "border-green-500 bg-green-500/10",
                      blue:  "border-blue-400 bg-blue-400/10",
                    };
                    const textMap: Record<string, string> = {
                      amber: isDark ? "text-amber-400" : "text-amber-600",
                      red:   isDark ? "text-red-400"   : "text-red-600",
                      green: isDark ? "text-green-400" : "text-green-700",
                      blue:  isDark ? "text-blue-400"  : "text-blue-600",
                    };

                    return (
                      <div
                        key={change.id}
                        className={`rounded-lg border p-2.5 text-[11px] transition-opacity ${colorMap[color]} ${change.reverted ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <span className={`font-bold uppercase text-[9px] tracking-wide ${textMap[color]}`}>
                              {ACTION_LABEL[change.action]}
                            </span>
                            <p className={`font-semibold truncate mt-0.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                              {disc?.code ?? (change.originalData?.disciplineId ?? change.newData?.disciplineId ?? "—").slice(0, 8)}
                            </p>
                            <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {disc?.name ?? ""}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevertChange(change)}
                            title={change.reverted ? "Restaurar" : "Desfazer"}
                            className={`flex-shrink-0 p-1 rounded transition-colors ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                          >
                            <RotateCcw size={11} />
                          </button>
                        </div>

                        {change.action === "MOVE" && change.originalData && change.newData && (
                          <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            <div className="flex items-center gap-1">
                              <Clock size={9} />
                              {change.originalData.date?.slice(5)} {change.originalData.startTime}
                            </div>
                            <MoveRight size={9} className="text-amber-400" />
                            <div className="font-semibold">
                              {change.newData.date?.slice(5)} {change.newData.startTime}
                            </div>
                          </div>
                        )}

                        {change.action === "DELETE" && change.originalData && (
                          <p className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {change.originalData.date?.slice(5)} {change.originalData.startTime} · {change.originalData.classId}
                          </p>
                        )}

                        {change.action === "ADD" && change.newData && (
                          <p className={`mt-1 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {change.newData.date?.slice(5)} {change.newData.startTime} · {change.newData.classId}
                          </p>
                        )}

                        <p className={`mt-1.5 text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                          {new Date(change.createdAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats footer */}
            <div className={`border-t px-4 py-3 space-y-1 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              {(["MOVE","ADD","DELETE","MODIFY"] as const).map((a) => {
                const cnt = activeChanges.filter((c) => c.action === a).length;
                if (cnt === 0) return null;
                return (
                  <div key={a} className={`flex justify-between text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <span>{ACTION_LABEL[a]}</span>
                    <span className="font-bold">{cnt}</span>
                  </div>
                );
              })}
              {activeChanges.length === 0 && (
                <p className={`text-[11px] text-center ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  Sem alterações ativas
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─── Add Event Modal ───────────────────────────────────────────────── */}
      {addModal && (
        <AddEventModal
          date={addModal.date}
          slotStart={addModal.slotStart}
          disciplines={disciplines}
          isDark={isDark}
          onConfirm={handleAddEvent}
          onCancel={() => setAddModal(null)}
        />
      )}

      {/* ─── Confirm Apply Modal ───────────────────────────────────────────── */}
      {confirmApply && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl border shadow-2xl p-6 max-w-md w-full ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-xl bg-green-500/10 flex-shrink-0">
                <Play size={20} className="text-green-500" />
              </div>
              <div>
                <h3 className={`font-bold text-base ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  Aplicar à Programação
                </h3>
                <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Isso aplicará <strong>{activeChanges.length} alteração(ões)</strong> à programação em produção. As aulas afetadas serão marcadas com <strong>{sap.numeroAlteracao}</strong>. Esta ação fica registrada em auditoria e não pode ser desfeita automaticamente.
                </p>
              </div>
            </div>

            <div className={`rounded-lg p-3 mb-4 text-xs space-y-1 ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
              {activeChanges.slice(0, 6).map((c) => {
                const disc = disciplineMap.get(c.originalData?.disciplineId ?? c.newData?.disciplineId ?? "");
                return (
                  <div key={c.id} className={`flex items-center gap-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    <span className={`font-bold text-[10px] w-12 ${ACTION_COLOR[c.action] === "red" ? "text-red-400" : ACTION_COLOR[c.action] === "green" ? "text-green-500" : "text-amber-400"}`}>
                      {ACTION_LABEL[c.action]}
                    </span>
                    <span className="truncate">{disc?.code ?? "?"} — {c.originalData?.date?.slice(5) ?? c.newData?.date?.slice(5)}</span>
                  </div>
                );
              })}
              {activeChanges.length > 6 && (
                <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  +{activeChanges.length - 6} mais...
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleApply}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Play size={14} /> Confirmar e Aplicar
              </button>
              <button
                onClick={() => setConfirmApply(false)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Apply Result Modal ────────────────────────────────────────────── */}
      {applyResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl border shadow-2xl p-6 max-w-sm w-full ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
            {applyResult.errors.length === 0 ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={28} className="text-green-500 flex-shrink-0" />
                  <div>
                    <h3 className={`font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Aplicado com sucesso!</h3>
                    <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{applyResult.applied} aula(s) alterada(s) e marcadas com {sap.numeroAlteracao}.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle size={24} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className={`font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Aplicado parcialmente</h3>
                    <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{applyResult.applied} sucesso, {applyResult.errors.length} erro(s).</p>
                  </div>
                </div>
                <div className={`rounded-lg p-3 text-xs space-y-1 mb-3 ${isDark ? "bg-red-900/20 border border-red-800" : "bg-red-50 border border-red-200"}`}>
                  {applyResult.errors.map((e, i) => (
                    <p key={i} className="text-red-400">{e}</p>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => { setApplyResult(null); navigate("/change-requests"); }}
              className="w-full py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold transition-colors"
            >
              Fechar e voltar à lista
            </button>
          </div>
        </div>
      )}

      {/* Applying overlay */}
      {applying && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className={`rounded-2xl p-8 flex flex-col items-center gap-3 ${isDark ? "bg-slate-900" : "bg-white"}`}>
            <Loader2 size={36} className="animate-spin text-green-500" />
            <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>Aplicando alterações...</p>
          </div>
        </div>
      )}
    </div>
  );
};
