import { useState } from "react";
import { X, Save, Trash2, Calendar, Clock, MapPin, FileText, Users } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { TIME_SLOTS, LOCATION_OPTIONS } from "../utils/constants";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ScheduleEvent } from "../types";

interface AcademicEventFormProps {
  initialData?: Partial<ScheduleEvent>;
  onSubmit: (data: Omit<ScheduleEvent, "id">) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

const SQUADRONS = [1, 2, 3, 4] as const;

export const ACADEMIC_COLORS: Record<string, { border: string; bg: string; title: string; sub: string; hover: string }> = {
  ALL: { border: "border-purple-400/40", bg: "bg-purple-500/15", title: "text-purple-900 dark:text-purple-300", sub: "text-purple-800 dark:text-purple-400", hover: "hover:bg-purple-500/25" },
  "1":  { border: "border-blue-400/40",   bg: "bg-blue-500/15",   title: "text-blue-900 dark:text-blue-300",   sub: "text-blue-800 dark:text-blue-400",   hover: "hover:bg-blue-500/25"   },
  "2":  { border: "border-emerald-400/40",bg: "bg-emerald-500/15",title: "text-emerald-900 dark:text-emerald-300",sub: "text-emerald-800 dark:text-emerald-400",hover: "hover:bg-emerald-500/25"},
  "3":  { border: "border-orange-400/40", bg: "bg-orange-500/15", title: "text-orange-900 dark:text-orange-300", sub: "text-orange-800 dark:text-orange-400", hover: "hover:bg-orange-500/25" },
  "4":  { border: "border-red-400/40",    bg: "bg-red-500/15",    title: "text-red-900 dark:text-red-300",    sub: "text-red-800 dark:text-red-400",    hover: "hover:bg-red-500/25"    },
};

export const getAcademicColor = (targetSquadron?: number | "ALL" | null) => {
  if (targetSquadron === "ALL" || targetSquadron == null) return ACADEMIC_COLORS["ALL"];
  return ACADEMIC_COLORS[String(targetSquadron)] ?? ACADEMIC_COLORS["ALL"];
};

export const AcademicEventForm = ({
  initialData,
  onSubmit,
  onDelete,
  onCancel,
}: AcademicEventFormProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const card     = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const inputCls = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500";
  const labelCls = isDark ? "text-gray-300" : "text-gray-600";
  const muted    = isDark ? "text-gray-400" : "text-gray-500";

  const wasAllDay = !initialData?.startTime;

  const today = new Date().toISOString().split("T")[0];

  const [title, setTitle]         = useState(initialData?.description ?? "");
  const [notes, setNotes]         = useState(initialData?.notes ?? "");
  const [startDate, setStartDate] = useState(initialData?.date ?? today);
  const [endDate, setEndDate]     = useState(initialData?.endDate ?? initialData?.date ?? today);
  const [allDay, setAllDay]       = useState(wasAllDay);
  const [startTime, setStartTime] = useState(wasAllDay ? "07:00" : (initialData?.startTime ?? "07:00"));
  const [endTime, setEndTime]     = useState(wasAllDay ? "" : (initialData?.endTime ?? ""));
  const [location, setLocation]   = useState(initialData?.location ?? "");
  const [squadron, setSquadron]   = useState<number | "ALL">(
    initialData?.targetSquadron === "ALL" || initialData?.targetSquadron == null
      ? "ALL"
      : Number(initialData.targetSquadron)
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isEditing = !!initialData?.id;

  const handleSubmit = () => {
    if (!title.trim()) return;
    const effectiveEnd = endDate < startDate ? startDate : endDate;
    onSubmit({
      disciplineId: "ACADEMIC",
      classId: initialData?.classId ?? "",
      date:    startDate,
      endDate: effectiveEnd,
      startTime: allDay ? "" : startTime,
      endTime:   allDay ? "" : (endTime || startTime),
      location:  location || undefined,
      type: "ACADEMIC" as any,
      description: title.trim(),
      notes: notes.trim() || undefined,
      targetSquadron: squadron === "ALL" ? "ALL" : squadron,
      targetCourse: initialData?.targetCourse,
      color: initialData?.color,
    });
  };

  const matchedSlot = TIME_SLOTS.find((s) => s.start === startTime);

  const sqBtn = (sq: number | "ALL", label: string) => {
    const active = squadron === sq;
    const col = ACADEMIC_COLORS[sq === "ALL" ? "ALL" : String(sq)];
    return (
      <button
        key={String(sq)}
        type="button"
        onClick={() => setSquadron(sq)}
        className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-colors ${
          active
            ? `${col.bg} ${col.border} ${col.title}`
            : isDark
              ? "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
              : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div className={`rounded-2xl border shadow-2xl ${card} overflow-hidden w-full max-w-md mx-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-purple-400" />
            <h2 className="text-sm font-bold text-purple-300">
              {isEditing ? "Editar Evento Acadêmico" : "Novo Evento Acadêmico"}
            </h2>
          </div>
          <button onClick={onCancel} className={`p-1 rounded-lg hover:bg-gray-600/40 transition-colors ${muted}`}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Título */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <FileText size={12} className="text-purple-400" />
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Início do Voo Primário, Recesso, Formatura..."
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputCls}`}
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <FileText size={12} className="text-purple-400" />
              Descrição <span className={`font-normal ${muted}`}>(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre o evento..."
              rows={2}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors resize-none ${inputCls}`}
            />
          </div>

          {/* Destinatário */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <Users size={12} className="text-purple-400" />
              Destinatário
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sqBtn("ALL", "Todos (CCAer)")}
              {SQUADRONS.map((n) => sqBtn(n, `${n}º Esq`))}
            </div>
          </div>

          {/* Período */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <Calendar size={12} className="text-purple-400" />
              Período
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <p className={`text-[10px] mb-1 ${muted}`}>Início</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className={`w-full rounded-lg border px-2 py-2 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
              <span className={`text-xs ${muted} mt-4`}>→</span>
              <div className="flex-1">
                <p className={`text-[10px] mb-1 ${muted}`}>Término</p>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full rounded-lg border px-2 py-2 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
            </div>
          </div>

          {/* Horário */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`flex items-center gap-1.5 text-xs font-semibold ${labelCls}`}>
                <Clock size={12} className="text-purple-400" />
                Horário
              </label>
              <label className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${muted}`}>
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="accent-purple-500 w-3.5 h-3.5"
                />
                Dia inteiro
              </label>
            </div>

            {!allDay && (
              <div className="flex gap-2 items-center">
                <select
                  value={matchedSlot ? startTime : ""}
                  onChange={(e) => {
                    const slot = TIME_SLOTS.find((s) => s.start === e.target.value);
                    if (slot) { setStartTime(slot.start); setEndTime(slot.end); }
                    else { setEndTime(""); }
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputCls}`}
                >
                  <option value="">Horário livre</option>
                  {TIME_SLOTS.map((s) => (
                    <option key={s.start} value={s.start}>{s.label}</option>
                  ))}
                </select>
                <span className={`text-xs ${muted} whitespace-nowrap`}>ou</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setEndTime(""); }}
                  className={`w-28 rounded-lg border px-2 py-2 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
            )}
            {!allDay && endTime && endTime !== startTime && (
              <p className={`text-[10px] mt-1 ${muted}`}>Término: {endTime}</p>
            )}
          </div>

          {/* Local */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <MapPin size={12} className="text-purple-400" />
              Local <span className={`font-normal ${muted}`}>(opcional)</span>
            </label>
            <input
              list="academic-locations"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Local do evento..."
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputCls}`}
            />
            <datalist id="academic-locations">
              {LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/40">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> Excluir
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className={`px-3 py-1.5 text-xs rounded-lg hover:bg-gray-600/30 transition-colors ${muted}`}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Save size={13} /> Salvar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Excluir evento acadêmico?"
        message={`"${title}" será removido permanentemente.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={() => { onDelete!(initialData!.id!); setDeleteConfirm(false); }}
        onClose={() => setDeleteConfirm(false)}
      />
    </>
  );
};
