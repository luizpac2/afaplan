import { useState } from "react";
import { X, Save, Trash2, Calendar, Clock, MapPin, FileText } from "lucide-react";
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

export const AcademicEventForm = ({
  initialData,
  onSubmit,
  onDelete,
  onCancel,
}: AcademicEventFormProps) => {
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const card = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const input = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500";
  const label = isDark ? "text-gray-300" : "text-gray-600";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  const [title, setTitle] = useState(initialData?.description ?? "");
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(initialData?.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(initialData?.endTime ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isEditing = !!initialData?.id;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      disciplineId: "ACADEMIC",
      classId: initialData?.classId ?? "",
      date,
      startTime,
      endTime: endTime || startTime,
      location: location || undefined,
      type: "ACADEMIC" as any,
      description: title.trim(),
      targetSquadron: initialData?.targetSquadron,
      targetCourse: initialData?.targetCourse,
      color: initialData?.color,
    });
  };

  // Find slot that matches startTime for convenience
  const matchedSlot = TIME_SLOTS.find((s) => s.start === startTime);

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
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${label}`}>
              <FileText size={12} className="text-purple-400" />
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Início do Voo Primário, Recesso, Formatura..."
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
              autoFocus
            />
          </div>

          {/* Data */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${label}`}>
              <Calendar size={12} className="text-purple-400" />
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
            />
          </div>

          {/* Horário */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${label}`}>
              <Clock size={12} className="text-purple-400" />
              Horário
            </label>
            <div className="flex gap-2 items-center">
              {/* Slot pré-definido */}
              <select
                value={matchedSlot ? startTime : ""}
                onChange={(e) => {
                  const slot = TIME_SLOTS.find((s) => s.start === e.target.value);
                  if (slot) { setStartTime(slot.start); setEndTime(slot.end); }
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
              >
                <option value="">Horário livre</option>
                {TIME_SLOTS.map((s) => (
                  <option key={s.start} value={s.start}>{s.label}</option>
                ))}
              </select>
              <span className={`text-xs ${muted} whitespace-nowrap`}>ou</span>
              {/* Livre */}
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-28 rounded-lg border px-2 py-2 text-sm outline-none transition-colors ${input}`}
              />
            </div>
            {endTime && endTime !== startTime && (
              <p className={`text-[10px] mt-1 ${muted}`}>Término: {endTime}</p>
            )}
          </div>

          {/* Local */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${label}`}>
              <MapPin size={12} className="text-purple-400" />
              Local <span className={`font-normal ${muted}`}>(opcional)</span>
            </label>
            <input
              list="academic-locations"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Local do evento..."
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
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

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={deleteConfirm}
          title="Excluir evento acadêmico?"
          message={`"${title}" será removido permanentemente.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={() => { onDelete!(initialData!.id!); setDeleteConfirm(false); }}
          onClose={() => setDeleteConfirm(false)}
        />
      )}
    </>
  );
};
