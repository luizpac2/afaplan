import { useState, useEffect, useMemo } from "react";
import {
  X,
  Save,
  Trash2,
  ArrowRightLeft,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useCourseStore } from "../store/useCourseStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTheme } from "../contexts/ThemeContext";
import { CLASSES, TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, EventType, EvaluationType } from "../types";

interface EventFormProps {
  initialData?: Partial<ScheduleEvent>;
  onSubmit: (data: Omit<ScheduleEvent, "id">) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isBatchMode?: boolean;
  lockClass?: boolean; // quando true, oculta seletores de esquadrão/turma (já definidos pelo slot)
}

export const EventForm = ({
  initialData,
  onSubmit,
  onDelete,
  onCancel,
  isBatchMode = false,
  lockClass = false,
}: EventFormProps) => {
  const { disciplines, swapEvents, instructors, classes } = useCourseStore();
  const { theme } = useTheme();

  // Verifica se um docente está habilitado para uma turma.
  // classId nos eventos é "1A", "2B" etc — o número é o ano do esquadrão.
  // enabledClasses armazena UUIDs das turmas (cohorts), então comparamos por ano.
  const isInstructorEnabledForClass = (inst: typeof instructors[0], classId: string): boolean => {
    if (!inst.enabledClasses?.length) return true; // sem restrição = habilitado para tudo
    const yearNum = parseInt(classId[0]);
    if (isNaN(yearNum)) return true;
    return inst.enabledClasses.some((enabledId) => {
      const cls = classes.find((c) => c.id === enabledId);
      return cls?.year === yearNum;
    });
  };

  const isInstructorEnabledForDiscipline = (inst: typeof instructors[0], disciplineId: string): boolean => {
    if (!inst.enabledDisciplines?.length) return true; // sem restrição = habilitado para tudo
    return inst.enabledDisciplines.includes(disciplineId);
  };
  const [showSwap, setShowSwap] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [swapData, setSwapData] = useState({
    classId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "07:00",
  });

  // Form state
  const [selectedSquadron, setSelectedSquadron] = useState<number | null>(null);
  const [disciplineSearch, setDisciplineSearch] = useState("");
  const [formData, setFormData] = useState({
    disciplineId: "",
    classId: "", // For backward compatibility in some logic
    classIds: [] as string[], // NEW: Support for multiple classes
    date: new Date().toISOString().split("T")[0],
    startTime: "07:00",
    endTime: "08:00",
    location: "",
    type: "CLASS" as EventType,
    evaluationType: "PARTIAL" as EvaluationType,
    instructorTrigram: "",
  });

  // Sorted disciplines for dropdowns
  const sortedDisciplines = useMemo(() => {
    return [...disciplines].sort((a, b) => {
      const nameComp = a.name.localeCompare(b.name, "pt-BR");
      if (nameComp !== 0) return nameComp;
      // Fallback to year if names are identical
      const yearA = a.year === "ALL" ? 0 : (a.year || 0);
      const yearB = b.year === "ALL" ? 0 : (b.year || 0);
      return yearA - yearB;
    });
  }, [disciplines]);

  // Initialize form data only once on mount if initialData is provided
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        disciplineId: initialData.disciplineId || "",
        classId: initialData.classId || "",
        classIds: initialData.classId ? [initialData.classId] : [],
        date: initialData.date || new Date().toISOString().split("T")[0],
        startTime: initialData.startTime || "07:00",
        endTime: initialData.endTime || "08:00",
        location:
          initialData.location ||
          disciplines.find((d) => d.id === initialData.disciplineId)
            ?.location ||
          "",
        type: initialData.type || "CLASS",
        evaluationType: initialData.evaluationType || "PARTIAL",
        instructorTrigram: initialData.instructorTrigram || "",
      }));

      // For editing, we usually have a single classId. Ensure it's in classIds.
      if (initialData.classId) {
        // Ensure selectedSquadron is set
        const squadron = parseInt(initialData.classId.charAt(0));
        if (!isNaN(squadron)) setSelectedSquadron(squadron);
      }

      // Extract squadron from classId (e.g., '1A' -> 1)
      if (initialData.classId) {
        const squadron = parseInt(initialData.classId.charAt(0));
        if (squadron >= 1 && squadron <= 4) {
          setSelectedSquadron(squadron);
        }
        // Pre-fill search with selected discipline name for convenience if editing
        const disc = disciplines.find((d) => d.id === initialData.disciplineId);
        if (disc) setDisciplineSearch(disc.name);
      }

      // Initialize swap data with current event data (convenience)
      setSwapData((prev) => ({
        ...prev,
        classId: initialData.classId || "",
        date: initialData.date || new Date().toISOString().split("T")[0],
        startTime: initialData.startTime || "07:00",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If there are multiple classIds, we create an event for each one.
    // We pass classIds specifically in the submission.
    (onSubmit as any)({ ...formData, classIds: formData.classIds });
  };

  const handleSwapSubmit = () => {
    if (initialData?.id && swapData.classId && swapData.date) {
      swapEvents(
        initialData.id,
        swapData.date,
        swapData.startTime,
        swapData.classId,
      );
      onCancel(); // Close modal
    }
  };

  const handleTimeSlotChange = (start: string) => {
    const slot = TIME_SLOTS.find((s) => s.start === start);
    if (slot) {
      setFormData((prev) => ({
        ...prev,
        startTime: slot.start,
        endTime: slot.end,
      }));
    }
  };

  // Derive course type from classId string (e.g. '1F' -> 'INFANTRY')
  const getCourseFromClassId = (
    classId: string,
  ): "AVIATION" | "INTENDANCY" | "INFANTRY" | null => {
    if (classId.endsWith("AVIATION")) return "AVIATION";
    if (classId.endsWith("INTENDANCY")) return "INTENDANCY";
    if (classId.endsWith("INFANTRY")) return "INFANTRY";
    if (classId.endsWith("ESQ")) return null; // all courses
    const letter = classId.slice(1).toUpperCase();
    if (["A", "B", "C", "D"].includes(letter)) return "AVIATION";
    if (letter === "E") return "INTENDANCY";
    if (letter === "F") return "INFANTRY";
    return null;
  };

  // Verifica se disciplina está habilitada para um dado esquadrão (ano) e curso
  // Suporta tanto o sistema legado (year/course/category) quanto o novo (enabledYears/enabledCourses)
  const isDisciplineEnabledFor = (
    d: typeof disciplines[0],
    squadron: number | null,
    course: "AVIATION" | "INTENDANCY" | "INFANTRY" | null,
  ): boolean => {
    const hasNewSystem = (d.enabledYears?.length ?? 0) > 0 || (d.enabledCourses?.length ?? 0) > 0;

    if (hasNewSystem) {
      // Novo sistema: enabledYears e enabledCourses
      const yearOk = !squadron || !d.enabledYears?.length || d.enabledYears.includes(squadron as any);
      const courseOk = !course || !d.enabledCourses?.length || d.enabledCourses.includes(course);
      return yearOk && courseOk;
    }

    // Sistema legado: year / course / category
    const yearOk = !squadron || d.year === squadron || d.year === "ALL";
    if (!yearOk) return false;
    if (!course) return true;
    return d.course === course || d.course === "ALL" || d.category === "COMMON";
  };

  const checkDisciplineCompatibility = (
    disciplineId: string,
    squadron: number | null,
    classId: string,
  ) => {
    if (!disciplineId) return true;
    const d = disciplines.find((disc) => disc.id === disciplineId);
    if (!d) return false;
    const course = classId ? getCourseFromClassId(classId) : null;
    return isDisciplineEnabledFor(d, squadron, course);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}
      >
        <div
          className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-gray-50/50 border-gray-100"}`}
        >
          <h2
            className={`text-lg  ${theme === "dark" ? "text-slate-100" : "text-gray-800"}`}
          >
            {isBatchMode
              ? "Alocação em Lote"
              : initialData?.id
                ? "Editar Evento"
                : "Novo Evento"}
          </h2>
          <button
            onClick={onCancel}
            className={`transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 1. Squadron / Class — oculto quando lockClass (já definido pelo slot) */}
          {lockClass ? (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${theme === "dark" ? "bg-slate-700/40 border-slate-600 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <span className="font-semibold">{formData.classId}</span>
              <span className="opacity-60">·</span>
              <span className="opacity-70">
                {getCourseFromClassId(formData.classId) === "AVIATION" ? "Aviação" :
                 getCourseFromClassId(formData.classId) === "INTENDANCY" ? "Intendência" :
                 getCourseFromClassId(formData.classId) === "INFANTRY" ? "Infantaria" : "Todas"}
              </span>
            </div>
          ) : (
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
              >
                Esquadrão
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      const squadron = num;
                      setSelectedSquadron(squadron);
                      setFormData((prev) => ({
                        ...prev,
                        classId: "",
                        disciplineId: checkDisciplineCompatibility(
                          prev.disciplineId,
                          squadron,
                          "",
                        )
                          ? prev.disciplineId
                          : "",
                      }));
                    }}
                    className={`py-2 text-sm  rounded-lg border transition-all ${selectedSquadron === num
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                      }`}
                  >
                    {num}º
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New: Event Type Selector */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
              >
                Tipo de Evento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, type: "CLASS" }))
                  }
                  className={`py-2 text-xs  rounded-lg border transition-all ${formData.type === "CLASS"
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                    }`}
                >
                  Aula
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, type: "EVALUATION" }))
                  }
                  className={`py-2 text-xs  rounded-lg border transition-all ${formData.type === "EVALUATION"
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                    }`}
                >
                  Avaliação
                </button>
              </div>
            </div>

            {formData.type === "EVALUATION" && (
              <div className="animate-in fade-in slide-in-from-left-2">
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                >
                  Tipo de Avaliação
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      "PARTIAL",
                      "EXAM",
                      "FINAL",
                      "SECOND_CHANCE",
                      "REVIEW",
                    ] as EvaluationType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          evaluationType: type,
                        }))
                      }
                      className={`py-1.5 px-2 text-[10px]  uppercase tracking-wider rounded-lg border transition-all ${formData.evaluationType === type
                        ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                        : `${theme === "dark" ? "bg-amber-900/10 border-amber-900/40 text-amber-500 hover:bg-amber-900/20" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"}`
                        }`}
                    >
                      {type === "PARTIAL"
                        ? "Parcial"
                        : type === "EXAM"
                          ? "Exame"
                          : type === "FINAL"
                            ? "Prova Final"
                            : type === "SECOND_CHANCE"
                              ? "2ª Época"
                              : "Vista"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Class Selector - SECOND (oculto quando lockClass) */}
          {!lockClass && selectedSquadron && (
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
              >
                Turma
              </label>
              <div className="flex flex-col gap-2">
                {/* Row 1: Scopes */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newClassId = `${selectedSquadron}ESQ`;
                      setFormData((prev) => ({
                        ...prev,
                        classId: newClassId,
                        classIds: [newClassId],
                        disciplineId: checkDisciplineCompatibility(
                          prev.disciplineId,
                          selectedSquadron,
                          newClassId,
                        )
                          ? prev.disciplineId
                          : "",
                      }));
                    }}
                    className={`px-3 py-1.5 text-[10px]  uppercase tracking-wider rounded-lg border transition-all ${formData.classIds.includes(`${selectedSquadron}ESQ`)
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                      }`}
                  >
                    Tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newClassId = `${selectedSquadron}AVIATION`;
                      setFormData((prev) => ({
                        ...prev,
                        classId: newClassId,
                        classIds: [newClassId],
                        disciplineId: checkDisciplineCompatibility(
                          prev.disciplineId,
                          selectedSquadron,
                          newClassId,
                        )
                          ? prev.disciplineId
                          : "",
                      }));
                    }}
                    className={`px-3 py-1.5 text-[10px]  uppercase tracking-wider rounded-lg border transition-all ${formData.classIds.includes(`${selectedSquadron}AVIATION`)
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                      }`}
                  >
                    Aviação
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newClassId = `${selectedSquadron}INTENDANCY`;
                      setFormData((prev) => ({
                        ...prev,
                        classId: newClassId,
                        classIds: [newClassId],
                        disciplineId: checkDisciplineCompatibility(
                          prev.disciplineId,
                          selectedSquadron,
                          newClassId,
                        )
                          ? prev.disciplineId
                          : "",
                      }));
                    }}
                    className={`px-3 py-1.5 text-[10px]  uppercase tracking-wider rounded-lg border transition-all ${formData.classIds.includes(
                      `${selectedSquadron}INTENDANCY`,
                    )
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                      }`}
                  >
                    Intendência
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newClassId = `${selectedSquadron}INFANTRY`;
                      setFormData((prev) => ({
                        ...prev,
                        classId: newClassId,
                        classIds: [newClassId],
                        disciplineId: checkDisciplineCompatibility(
                          prev.disciplineId,
                          selectedSquadron,
                          newClassId,
                        )
                          ? prev.disciplineId
                          : "",
                      }));
                    }}
                    className={`px-3 py-1.5 text-[10px]  uppercase tracking-wider rounded-lg border transition-all ${formData.classIds.includes(`${selectedSquadron}INFANTRY`)
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                      }`}
                  >
                    Infantaria
                  </button>
                </div>

                {/* Row 2: Turmas */}
                <div className="flex flex-wrap gap-2">
                  {["A", "B", "C", "D", "E", "F"].map((letter) => {
                    const classId = `${selectedSquadron}${letter}`;
                    const isActive = formData.classIds.includes(classId);
                    return (
                      <button
                        key={classId}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            // Toggle logic
                            let newClassIds = [...prev.classIds];

                            // If it was a scope (ESQ, AVIATION...), clear it and start fresh with individual classes
                            const isScopeActive = prev.classIds.some(
                              (id) =>
                                id.endsWith("ESQ") ||
                                id.endsWith("AVIATION") ||
                                id.endsWith("INTENDANCY") ||
                                id.endsWith("INFANTRY"),
                            );

                            if (isScopeActive) {
                              newClassIds = [classId];
                            } else {
                              if (isActive) {
                                newClassIds = newClassIds.filter(
                                  (id) => id !== classId,
                                );
                              } else {
                                newClassIds.push(classId);
                              }
                            }

                            return {
                              ...prev,
                              classId: newClassIds[0] || "",
                              classIds: newClassIds,
                              disciplineId: checkDisciplineCompatibility(
                                prev.disciplineId,
                                selectedSquadron,
                                newClassIds[0] || "",
                              )
                                ? prev.disciplineId
                                : "",
                            };
                          });
                        }}
                        className={`w-10 h-10 flex items-center justify-center text-sm  rounded-lg border transition-all ${isActive
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : `${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`
                          }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. Discipline Selection - THIRD (Search instead of dropdown) */}
          {selectedSquadron && formData.classIds.length > 0 && (
            <div className="flex flex-col gap-2">
              <label
                className={`block text-sm  ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
              >
                Disciplina
              </label>

              {/* Selected Discipline View or Search Input */}
              {formData.disciplineId ? (
                <div className="space-y-4">
                  <div
                    className={`flex items-center justify-between p-3 rounded-xl border animate-in fade-in zoom-in-95 duration-200 ${theme === "dark" ? "bg-blue-900/10 border-blue-800 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-700"}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px]  uppercase tracking-widest opacity-70">
                        {
                          disciplines.find(
                            (d) => d.id === formData.disciplineId,
                          )?.code
                        }
                      </span>
                      <span className="text-sm ">
                        {
                          disciplines.find(
                            (d) => d.id === formData.disciplineId,
                          )?.name
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          disciplineId: "",
                          instructorTrigram: "",
                        }));
                        setDisciplineSearch("");
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "hover:bg-blue-800" : "hover:bg-white text-red-500"}`}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Instructor Selection - Shown only when discipline is selected */}
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className={`block text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Docente da Aula
                      </label>
                      {(() => {
                        const trigram =
                          formData.instructorTrigram ||
                          disciplines.find(
                            (d) => d.id === formData.disciplineId,
                          )?.instructorTrigram;
                        if (!trigram) return null;
                        const inst = instructors.find(
                          (i) => i.trigram === trigram,
                        );
                        const isUnauthorizedClasses =
                          inst &&
                          !formData.classIds.every((cid) =>
                            isInstructorEnabledForClass(inst, cid),
                          );
                        const isUnauthorizedDisc =
                          inst &&
                          !isInstructorEnabledForDiscipline(inst, formData.disciplineId);

                        if (isUnauthorizedClasses || isUnauthorizedDisc) {
                          return (
                            <span className="flex items-center gap-1 text-[9px]  text-red-500 animate-pulse">
                              <AlertTriangle size={12} />
                              Não Habilitado
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <select
                      value={formData.instructorTrigram || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          instructorTrigram: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all  ${theme === "dark" ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
                    >
                      <option value="">
                        {disciplines.find((d) => d.id === formData.disciplineId)
                          ?.noSpecificInstructor
                          ? "Sem Instrutor (Setor)"
                          : "Docente da Disciplina"}
                      </option>
                      {instructors
                        .filter((inst) => {
                          return (
                            isInstructorEnabledForDiscipline(inst, formData.disciplineId) &&
                            formData.classIds.every((cid) => isInstructorEnabledForClass(inst, cid))
                          );
                        })
                        .map((inst) => (
                          <option key={inst.trigram} value={inst.trigram}>
                            {inst.trigram} - {inst.warName}
                          </option>
                        ))}
                    </select>
                    {(() => {
                      const trigram =
                        formData.instructorTrigram ||
                        disciplines.find((d) => d.id === formData.disciplineId)
                          ?.instructorTrigram;
                      const inst = trigram
                        ? instructors.find((i) => i.trigram === trigram)
                        : null;
                      const isUnauthorizedClasses =
                        inst &&
                        !formData.classIds.every((cid) =>
                          isInstructorEnabledForClass(inst, cid),
                        );
                      const isUnauthorizedDisc =
                        inst &&
                        !isInstructorEnabledForDiscipline(inst, formData.disciplineId);

                      if (isUnauthorizedClasses || isUnauthorizedDisc) {
                        return (
                          <p className="text-[10px] text-red-500 mt-1  italic">
                            ⚠️ Este docente não está habilitado para{" "}
                            {isUnauthorizedDisc
                              ? "esta disciplina"
                              : "todas as turmas selecionadas"}
                            .
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 relative">
                  <div className="relative">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                    />
                    <input
                      type="text"
                      placeholder="Digite o código ou nome da disciplina..."
                      value={disciplineSearch}
                      onChange={(e) => setDisciplineSearch(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-gray-200 text-slate-900"}`}
                    />
                  </div>

                  {/* Search Results - Overlaid */}
                  {disciplineSearch && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1">
                      {(() => {
                        const filtered = sortedDisciplines.filter((d) => {
                          const term = disciplineSearch.toLowerCase();
                          if (
                            !d.name.toLowerCase().includes(term) &&
                            !d.code.toLowerCase().includes(term)
                          )
                            return false;
                          const targetCourse = getCourseFromClassId(formData.classIds[0] || "");
                          return isDisciplineEnabledFor(d, selectedSquadron, targetCourse);
                        });

                        if (filtered.length === 0) return null;

                        return (
                          <div
                            className={`max-h-[220px] overflow-y-auto rounded-xl border shadow-2xl custom-scrollbar animate-in slide-in-from-top-2 duration-300 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
                          >
                            {filtered.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    disciplineId: d.id,
                                    location: d.location || prev.location,
                                    instructorTrigram:
                                      d.instructorTrigram || "",
                                  }));
                                  setDisciplineSearch(d.name);
                                }}
                                className={`w-full flex items-center justify-between p-2.5 text-left transition-colors border-b last:border-0 ${theme === "dark" ? "hover:bg-slate-750 border-slate-700/50" : "hover:bg-blue-50 border-gray-50"}`}
                              >
                                <div className="flex flex-col">
                                  <span
                                    className={`text-[9px]  uppercase tracking-widest ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
                                  >
                                    {d.code}
                                  </span>
                                  <span
                                    className={`text-xs  ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}
                                  >
                                    {d.name}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px]  uppercase opacity-40 ${theme === "dark" ? "text-slate-400" : "text-gray-400"}`}
                                >
                                  {d.year === "ALL" ? "Todos" : `${d.year}º`}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isBatchMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                >
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300"}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                >
                  Local da Aula
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300"}`}
                  placeholder="Ex: Sala de Aula, Cinema"
                />
              </div>
            </div>
          )}

          {!isBatchMode && (
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
              >
                Horário
              </label>
              <select
                required
                value={formData.startTime}
                onChange={(e) => handleTimeSlotChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300"}`}
              >
                {TIME_SLOTS.map((slot) => (
                  <option
                    key={slot.start}
                    value={slot.start}
                    className={theme === "dark" ? "bg-slate-800" : ""}
                  >
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBatchMode && (
            <div
              className={`border rounded-lg p-3 text-sm ${theme === "dark" ? "bg-blue-900/20 border-blue-800 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"}`}
            >
              <strong>Nota:</strong> Data e horário serão definidos
              automaticamente pelos slots selecionados.
            </div>
          )}

          <div
            className={`pt-4 flex justify-between border-t mt-6 ${theme === "dark" ? "border-slate-700" : "border-gray-100"}`}
          >
            {initialData?.id && onDelete ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className={`px-4 py-2 text-sm  rounded-lg transition-colors flex items-center gap-2 ${theme === "dark" ? "text-red-400 hover:bg-red-400/10" : "text-red-600 hover:bg-red-50"}`}
              >
                <Trash2 size={18} />
                Excluir
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex gap-3">
              {initialData?.id && (
                <button
                  type="button"
                  onClick={() => setShowSwap(true)}
                  className={`px-4 py-2 text-sm  rounded-lg transition-colors flex items-center gap-2 ${theme === "dark" ? "text-orange-400 bg-orange-400/10 hover:bg-orange-400/20" : "text-orange-600 bg-orange-50 hover:bg-orange-100"}`}
                >
                  <ArrowRightLeft size={18} />
                  Trocar com...
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className={`px-4 py-2 text-sm  rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-gray-700 hover:bg-gray-100"}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 text-sm  text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <Save size={18} />
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Swap Modal Overlay */}
      {showSwap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div
            className={`rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}
          >
            <div
              className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-gray-50/50 border-gray-100"}`}
            >
              <h3
                className={`text-lg  ${theme === "dark" ? "text-slate-100" : "text-gray-800"}`}
              >
                Trocar Horário
              </h3>
              <button
                onClick={() => setShowSwap(false)}
                className={`transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600"}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p
                className={`text-sm mb-4 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
              >
                Selecione o destino para mover ou trocar a disciplina{" "}
                <strong>
                  {
                    disciplines.find((d) => d.id === formData.disciplineId)
                      ?.name
                  }
                </strong>
                . Se houver aula no destino, elas serão trocadas.
              </p>

              <div>
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                >
                  Turma de Destino
                </label>
                <select
                  value={swapData.classId}
                  onChange={(e) =>
                    setSwapData({ ...swapData, classId: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300 text-gray-900"}`}
                >
                  <option
                    value=""
                    className={theme === "dark" ? "bg-slate-800" : ""}
                  >
                    Selecione a Turma
                  </option>
                  {CLASSES.map((c) => (
                    <option
                      key={c}
                      value={c}
                      className={theme === "dark" ? "bg-slate-800" : ""}
                    >
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Data
                  </label>
                  <input
                    type="date"
                    value={swapData.date}
                    onChange={(e) =>
                      setSwapData({ ...swapData, date: e.target.value })
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300"}`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                  >
                    Horário
                  </label>
                  <select
                    value={swapData.startTime}
                    onChange={(e) =>
                      setSwapData({ ...swapData, startTime: e.target.value })
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "border-gray-300"}`}
                  >
                    <option
                      value=""
                      className={theme === "dark" ? "bg-slate-800" : ""}
                    >
                      Selecione o Horário
                    </option>
                    {TIME_SLOTS.map((slot) => (
                      <option
                        key={slot.start}
                        value={slot.start}
                        className={theme === "dark" ? "bg-slate-800" : ""}
                      >
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`px-6 py-4 flex justify-end gap-3 border-t ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-gray-50/50 border-gray-100"}`}
            >
              <button
                type="button"
                onClick={() => setShowSwap(false)}
                className={`px-4 py-2 text-sm  rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-gray-700 hover:bg-gray-100"}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSwapSubmit}
                disabled={!swapData.classId || !swapData.date}
                className="flex items-center gap-2 px-4 py-2 text-sm  text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft size={18} />
                Confirmar Troca
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => {
          if (initialData?.id && onDelete) {
            onDelete(initialData.id);
          }
        }}
        title="Excluir Aula"
        message={`Tem certeza que deseja excluir esta aula de "${disciplines.find((d) => d.id === formData.disciplineId)?.name || "disciplina"}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
