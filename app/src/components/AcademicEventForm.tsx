import { useState } from "react";
import { X, Save, Trash2, Calendar, Clock, MapPin, FileText, Users, Ban, Shield, Plane, ClipboardList } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
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

type ColorSet = { border: string; bg: string; title: string; sub: string; hover: string };

const COLORS_DARK: Record<string, ColorSet> = {
  ALL: { border: "border-purple-400/40", bg: "bg-purple-500/15", title: "text-purple-300", sub: "text-purple-400", hover: "hover:bg-purple-500/25" },
  "1": { border: "border-blue-400/40",   bg: "bg-blue-500/15",   title: "text-blue-300",   sub: "text-blue-400",   hover: "hover:bg-blue-500/25"   },
  "2": { border: "border-emerald-400/40",bg: "bg-emerald-500/15",title: "text-emerald-300",sub: "text-emerald-400",hover: "hover:bg-emerald-500/25" },
  "3": { border: "border-orange-400/40", bg: "bg-orange-500/15", title: "text-orange-300", sub: "text-orange-400", hover: "hover:bg-orange-500/25" },
  "4": { border: "border-red-400/40",    bg: "bg-red-500/15",    title: "text-red-300",    sub: "text-red-400",    hover: "hover:bg-red-500/25"    },
};

const COLORS_LIGHT: Record<string, ColorSet> = {
  ALL: { border: "border-purple-500/50", bg: "bg-purple-100",   title: "text-purple-900", sub: "text-purple-800", hover: "hover:bg-purple-200"   },
  "1": { border: "border-blue-500/50",   bg: "bg-blue-100",     title: "text-blue-900",   sub: "text-blue-800",   hover: "hover:bg-blue-200"     },
  "2": { border: "border-emerald-500/50",bg: "bg-emerald-100",  title: "text-emerald-900",sub: "text-emerald-800",hover: "hover:bg-emerald-200"  },
  "3": { border: "border-orange-500/50", bg: "bg-orange-100",   title: "text-orange-900", sub: "text-orange-800", hover: "hover:bg-orange-200"   },
  "4": { border: "border-red-500/50",    bg: "bg-red-100",      title: "text-red-900",    sub: "text-red-800",    hover: "hover:bg-red-200"      },
};

export const getAcademicColor = (targetSquadron: number | "ALL" | null | undefined, isDark: boolean): ColorSet => {
  const key = (targetSquadron === "ALL" || targetSquadron == null) ? "ALL" : String(targetSquadron);
  return (isDark ? COLORS_DARK : COLORS_LIGHT)[key] ?? (isDark ? COLORS_DARK : COLORS_LIGHT)["ALL"];
};

type EvalType = "PARTIAL" | "EXAM" | "FINAL" | "SECOND_CHANCE" | "REVIEW";

const EVAL_TYPE_OPTIONS: { key: EvalType; label: string }[] = [
  { key: "PARTIAL",       label: "PARCIAL"   },
  { key: "EXAM",          label: "EXAME"     },
  { key: "FINAL",         label: "FINAL"     },
  { key: "SECOND_CHANCE", label: "2ª ÉPOCA"  },
  { key: "REVIEW",        label: "VISTA"     },
];

export const AcademicEventForm = ({
  initialData,
  onSubmit,
  onDelete,
  onCancel,
}: AcademicEventFormProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { disciplines } = useCourseStore();

  const card     = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const inputCls = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500";
  const labelCls = isDark ? "text-gray-300" : "text-gray-600";
  const muted    = isDark ? "text-gray-400" : "text-gray-500";

  type Category = "ACADEMIC" | "EVALUATION" | "DAY_OFF" | "COMMEMORATIVE" | "SPORTS" | "INFORMATIVE" | "HOLIDAY" | "MILITARY" | "FLIGHT_INSTRUCTION" | "TRIP";
  const initCat: Category =
    initialData?.type === "EVALUATION"         ? "EVALUATION"        :
    initialData?.type === "DAY_OFF"            ? "DAY_OFF"           :
    initialData?.type === "COMMEMORATIVE"      ? "COMMEMORATIVE"     :
    initialData?.type === "SPORTS"             ? "SPORTS"            :
    initialData?.type === "INFORMATIVE"        ? "INFORMATIVE"       :
    initialData?.type === "HOLIDAY"            ? "HOLIDAY"           :
    initialData?.type === "MILITARY"           ? "MILITARY"          :
    initialData?.type === "FLIGHT_INSTRUCTION" ? "FLIGHT_INSTRUCTION":
    initialData?.type === "TRIP"               ? "TRIP"              : "ACADEMIC";

  const [category, setCategory] = useState<Category>(initCat);
  const wasAllDay = !initialData?.startTime || initialData.startTime === "";

  const today = new Date().toISOString().split("T")[0];

  const defaultTitle = initCat === "DAY_OFF" ? "Day Off" : "";
  const [title, setTitle]         = useState(initialData?.type === "EVALUATION" ? "" : (initialData?.description ?? initialData?.location ?? defaultTitle));
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

  // Evaluation-specific state
  const [evalDisciplineId, setEvalDisciplineId] = useState<string>(
    initialData?.type === "EVALUATION" ? (initialData.disciplineId ?? "") : ""
  );
  const [evalType, setEvalType] = useState<EvalType>(
    (initialData?.evaluationType as EvalType) ?? "PARTIAL"
  );

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isEditing = !!initialData?.id;

  const isEvalValid = category !== "EVALUATION" || (evalDisciplineId !== "" && evalType !== undefined);
  const isTitleValid = category === "EVALUATION" ? isEvalValid : !!title.trim();

  const handleSubmit = () => {
    if (!isTitleValid) return;
    const effectiveEnd = endDate < startDate ? startDate : endDate;

    if (category === "EVALUATION") {
      onSubmit({
        disciplineId: evalDisciplineId,
        classId: initialData?.classId ?? "",
        date:    startDate,
        endDate: effectiveEnd,
        startTime: allDay ? null as any : startTime,
        endTime:   allDay ? null as any : (endTime || startTime),
        location:  location || undefined,
        type: "EVALUATION" as any,
        evaluationType: evalType as any,
        description: undefined,
        notes: notes.trim() || undefined,
        targetSquadron: squadron === "ALL" ? "ALL" : squadron as any,
        targetCourse: null,
        targetClass: null,
        color: initialData?.color,
      });
      return;
    }

    onSubmit({
      disciplineId: "ACADEMIC",
      classId: initialData?.classId ?? "",
      date:    startDate,
      endDate: effectiveEnd,
      startTime: (allDay || ["DAY_OFF","COMMEMORATIVE","INFORMATIVE","HOLIDAY"].includes(category)) ? null as any : startTime,
      endTime:   (allDay || ["DAY_OFF","COMMEMORATIVE","INFORMATIVE","HOLIDAY"].includes(category)) ? null as any : (endTime || startTime),
      location:  (["DAY_OFF","COMMEMORATIVE","INFORMATIVE","HOLIDAY"].includes(category)) ? undefined : (location || undefined),
      type: category as any,
      description: title.trim(),
      notes: notes.trim() || undefined,
      targetSquadron: category === "DAY_OFF" ? "ALL" : (squadron === "ALL" ? "ALL" : squadron as any),
      targetCourse: null,
      targetClass: null,
      color: initialData?.color,
    });
  };

  const matchedSlot = TIME_SLOTS.find((s) => s.start === startTime);

  const sqBtn = (sq: number | "ALL", label: string) => {
    const active = squadron === sq;
    const col = getAcademicColor(sq === "ALL" ? "ALL" : sq, isDark);
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
        {(() => {
          const hdrMap: Record<string, { border: string; bg: string; icon: React.ReactNode; textCls: string; label: string }> = {
            ACADEMIC:          { border: "border-purple-500/30",  bg: "bg-purple-500/10",  icon: <Calendar size={16} className="text-purple-400" />,      textCls: "text-purple-300",  label: "Evento Acadêmico"  },
            EVALUATION:        { border: "border-orange-500/30",  bg: "bg-orange-500/10",  icon: <ClipboardList size={16} className="text-orange-400" />,  textCls: "text-orange-300",  label: "Avaliação"         },
            DAY_OFF:           { border: "border-red-500/30",     bg: "bg-red-500/10",     icon: <Ban size={16} className="text-red-400" />,               textCls: "text-red-300",     label: "Day Off"           },
            COMMEMORATIVE:     { border: "border-amber-500/30",   bg: "bg-amber-500/10",   icon: <Calendar size={16} className="text-amber-400" />,        textCls: "text-amber-300",   label: "Comemorativo"      },
            SPORTS:            { border: "border-teal-500/30",    bg: "bg-teal-500/10",    icon: <Calendar size={16} className="text-teal-400" />,         textCls: "text-teal-300",    label: "CDEF"              },
            INFORMATIVE:       { border: "border-sky-500/30",     bg: "bg-sky-500/10",     icon: <Calendar size={16} className="text-sky-400" />,          textCls: "text-sky-300",     label: "Informativo"       },
            HOLIDAY:           { border: "border-rose-500/30",    bg: "bg-rose-500/10",    icon: <Calendar size={16} className="text-rose-400" />,         textCls: "text-rose-300",    label: "Feriado"           },
            MILITARY:          { border: "border-green-500/30",   bg: "bg-green-500/10",   icon: <Shield size={16} className="text-green-400" />,          textCls: "text-green-300",   label: "Militar"           },
            FLIGHT_INSTRUCTION:{ border: "border-blue-500/30",    bg: "bg-blue-500/10",    icon: <Plane size={16} className="text-blue-400" />,            textCls: "text-blue-300",    label: "Instrução de Voo"  },
            TRIP:              { border: "border-violet-500/30",  bg: "bg-violet-500/10",  icon: <MapPin size={16} className="text-violet-400" />,         textCls: "text-violet-300",  label: "Viagem"            },
          };
          const h = hdrMap[category] ?? hdrMap.ACADEMIC;
          return (
            <div className={`flex items-center justify-between px-5 py-4 border-b ${h.border} ${h.bg}`}>
              <div className="flex items-center gap-2">
                {h.icon}
                <h2 className={`text-sm font-bold ${h.textCls}`}>
                  {isEditing ? `Editar ${h.label}` : `Novo ${h.label}`}
                </h2>
              </div>
              <button onClick={onCancel} className={`p-1 rounded-lg hover:bg-gray-600/40 transition-colors ${muted}`}>
                <X size={16} />
              </button>
            </div>
          );
        })()}

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Categoria */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "ACADEMIC",           label: "Acadêmico",        active: "bg-purple-600 border-purple-600 text-white",  hover: "hover:border-purple-500"  },
                { key: "EVALUATION",         label: "Avaliação",        active: "bg-orange-600 border-orange-600 text-white",  hover: "hover:border-orange-500"  },
                { key: "DAY_OFF",            label: "Day Off",          active: "bg-red-600 border-red-600 text-white",        hover: "hover:border-red-500"     },
                { key: "COMMEMORATIVE",      label: "Comemorativo",     active: "bg-amber-500 border-amber-500 text-white",    hover: "hover:border-amber-500"   },
                { key: "SPORTS",             label: "CDEF",             active: "bg-teal-600 border-teal-600 text-white",      hover: "hover:border-teal-500"    },
                { key: "INFORMATIVE",        label: "Informativo",      active: "bg-sky-500 border-sky-500 text-white",        hover: "hover:border-sky-500"     },
                { key: "HOLIDAY",            label: "Feriado",          active: "bg-rose-600 border-rose-600 text-white",      hover: "hover:border-rose-500"    },
                { key: "MILITARY",           label: "Militar",          active: "bg-green-600 border-green-600 text-white",    hover: "hover:border-green-500"   },
                { key: "FLIGHT_INSTRUCTION", label: "Instrução de Voo", active: "bg-blue-600 border-blue-600 text-white",      hover: "hover:border-blue-500"    },
                { key: "TRIP",               label: "Viagem",           active: "bg-violet-600 border-violet-600 text-white",  hover: "hover:border-violet-500"  },
              ] as const).map(opt => (
                <button key={opt.key} type="button"
                  onClick={() => {
                    setCategory(opt.key as any);
                    if (opt.key === "DAY_OFF") { if (!title.trim()) setTitle("Day Off"); setAllDay(true); }
                    if (opt.key !== "DAY_OFF" && title === "Day Off") setTitle("");
                  }}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors
                    ${category === opt.key
                      ? opt.active
                      : isDark ? `border-gray-600 text-gray-400 ${opt.hover}` : `border-gray-300 text-gray-500 ${opt.hover}`
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {category === "DAY_OFF" && (
              <p className={`text-[10px] mt-1.5 ${muted}`}>Inviabiliza alocação de aulas neste dia.</p>
            )}
          </div>

          {/* Campos específicos de Avaliação */}
          {category === "EVALUATION" && (
            <>
              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
                  <ClipboardList size={12} className="text-orange-400" />
                  Disciplina *
                </label>
                <select
                  value={evalDisciplineId}
                  onChange={(e) => setEvalDisciplineId(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${inputCls}`}
                >
                  <option value="">Selecione a disciplina...</option>
                  {disciplines.map(d => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
                  <FileText size={12} className="text-orange-400" />
                  Tipo de Avaliação *
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVAL_TYPE_OPTIONS.map(opt => (
                    <button key={opt.key} type="button"
                      onClick={() => setEvalType(opt.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        evalType === opt.key
                          ? "bg-orange-600 border-orange-600 text-white"
                          : isDark
                            ? "border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-300"
                            : "border-gray-300 text-gray-500 hover:border-orange-500 hover:text-orange-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Título — oculto para Avaliação */}
          {category !== "EVALUATION" && (
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
          )}

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

          {/* Destinatário — oculto para Day Off (sempre todos) */}
          {category !== "DAY_OFF" && <div>
            <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${labelCls}`}>
              <Users size={12} className="text-purple-400" />
              Destinatário
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sqBtn("ALL", "Todos (CCAer)")}
              {SQUADRONS.map((n) => sqBtn(n, `${n}º Esq`))}
            </div>
          </div>}

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

          {/* Horário — oculto para Day Off, Comemorativo, Informativo e Feriado */}
          {!["DAY_OFF","COMMEMORATIVE","INFORMATIVE","HOLIDAY"].includes(category) && <div>
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
          </div>}

          {/* Local — oculto para Day Off, Comemorativo, Informativo e Feriado */}
          {!["DAY_OFF","COMMEMORATIVE","INFORMATIVE","HOLIDAY"].includes(category) && <div>
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
          </div>}
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
              disabled={!isTitleValid}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Save size={13} /> Salvar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Excluir evento?"
        message={`Este evento será removido permanentemente.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={() => { onDelete!(initialData!.id!); setDeleteConfirm(false); }}
        onClose={() => setDeleteConfirm(false)}
      />
    </>
  );
};
