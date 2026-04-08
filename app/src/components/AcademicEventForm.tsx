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

// Sentinela para "dia inteiro" — startTime e endTime ficam vazios no card
const ALL_DAY_SENTINEL = "";

export const AcademicEventForm = ({
  initialData,
  onSubmit,
  onDelete,
  onCancel,
}: AcademicEventFormProps) => {
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const card = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const inputCls = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500";
  const labelCls = isDark ? "text-gray-300" : "text-gray-600";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  // Detecta se o evento salvo era "dia inteiro" (startTime vazio)
  const wasAllDay = !initialData?.startTime || initialData.startTime === ALL_DAY_SENTINEL;

  const [title, setTitle]         = useState(initialData?.description ?? "");
  const [date, setDate]           = useState(initialData?.date ?? new Date().toISOString().split("T")[0]);
  const [allDay, setAllDay]       = useState(wasAllDay);
  const [startTime, setStartTime] = useState(wasAllDay ? "07:00" : (initialData?.startTime ?? "07:00"));
  const [endTime, setEndTime]     = useState(wasAllDay ? "" : (initialData?.endTime ?? ""));
  const [location, setLocation]   = useState(initialData?.location ?? "");
  // targetSquadron: null = "Todos (CCAer)", number = esquadrão específico
  const [squadron, setSquadron]   = useState<number | "ALL">(
    initialData?.targetSquadron === "ALL" || initialData?.targetSquadron == null
      ? "ALL"
      : Number(initialData.targetSquadron)
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isEditing = !!initialData?.id;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      disciplineId: "ACADEMIC",
      classId: initialData?.classId ?? "",
      date,
      startTime: allDay ? ALL_DAY_SENTINEL : startTime,
      endTime:   allDay ? ALL_DAY_SENTINEL : (endTime || startTime),
      location:  location || undefined,
      type: "ACADEMIC" as any,
      description: title.trim(),
      targetSquadron: squadron === "ALL" ? "ALL" : squadron,
      targetCourse: initialData?.targetCourse,
      color: initialData?.color,
    });
  };

  const matchedSlot = TIME_SLOTS.find((s) => s.start === startTime);

  const sqBtn = (sq: number | "ALL", label: string) => {
    const active = squadron === sq;
    return (
      <button
        key={String(sq)}
        type="button"
        onClick={() => setSquadron(sq)}
        className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-colors ${
          active
            ? "bg-purple-600 border-purple-500 text-white"
            : isDark
              ? "border-gray-600 text-gray-400 hover:border-purple-500 hover:text-purple-300"
              : "border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600"
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

          {/* Esquadrão */}
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

          {/* Data */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <Calendar size={12} className="text-purple-400" />
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputCls}`}
            />
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
            {allDay && (
              <p className={`text-[10px] italic ${muted}`}>O horário não será exibido no card.</p>
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
