import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { CalendarGrid } from "../components/CalendarGrid";
import { EventForm } from "../components/EventForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  getStartOfWeek,
  addDays,
  formatDate,
  getWeekDays,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, CourseYear } from "../types";
import { subscribeToEventsByDateRange } from "../services/supabaseService";
import {
  exportScheduleToExcel,
  exportScheduleToPDF,
} from "../utils/exportUtils";

export const Programming = () => {
  const {
    disciplines,
    cohorts,
    addEvent,
    updateEvent,
    deleteEvent,
    deleteBatchEvents,
    swapEvents,
    fetchYearlyEvents,
  } = useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>(
    undefined,
  );

  const canEdit = useMemo(() => {
    return ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || "");
  }, [userProfile]);

  // Batch Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]); // "YYYY-MM-DD|HH:mm"
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearWeekConfirmOpen, setIsClearWeekConfirmOpen] = useState(false);

  // Filters
  const [selectedYear, setSelectedYear] = useState<CourseYear>(1); // Squadron Year (1-4) - Default to 1st Squadron
  const [selectedClass, setSelectedClass] = useState<string>("A"); // Class Letter (e.g., 'A', 'B')
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear(),
  ); // Analysis Year
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = getWeekDays(startOfWeek);

  // Window Query state
  const [classEvents, setClassEvents] = useState<ScheduleEvent[]>([]);

  const startDay = formatDate(startOfWeek);
  const endDay = formatDate(addDays(startOfWeek, 6));

  useEffect(() => {
    console.log(
      `📡 Iniciando Sync da programação para a semana de ${startDay} (Otimizado v1.8.0)`,
    );

    const unsubscribe = subscribeToEventsByDateRange(startDay, endDay, (data) => {
      setClassEvents(data as ScheduleEvent[]);
    });

    return () => unsubscribe();
  }, [startDay, endDay]); // Re-subscribe ONLY on week change

  // Helper: Get Cohort Name for a specific Squadron in the selected Calendar Year
  const getCohortNameForSquadron = (squadronYear: CourseYear) => {
    const targetEntryYear = calendarYear - Number(squadronYear) + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === targetEntryYear);
    return cohort ? cohort.name : null;
  };

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(new Date());

  // Simplified Filter Logic (runs locally, 0 reads)
  const filteredEvents = useMemo(() => {
    const targetClassId = `${selectedYear}${selectedClass}`;

    // Helper to determine course from class ID
    const getCourseFromClassId = (classId: string) => {
      if (classId.endsWith("AVIATION")) return "AVIATION";
      if (classId.endsWith("INTENDANCY")) return "INTENDANCY";
      if (classId.endsWith("INFANTRY")) return "INFANTRY";
      const letter = classId.slice(1, 2).toUpperCase();
      if (["A", "B", "C", "D"].includes(letter)) return "AVIATION";
      if (letter === "E") return "INTENDANCY";
      if (letter === "F") return "INFANTRY";
      return null;
    };

    const targetCourse = getCourseFromClassId(targetClassId);

    return classEvents.filter((event) => {
      const isAcad =
        event.type === "ACADEMIC" || event.disciplineId === "ACADEMIC";

      // Filter by selected year
      const eventYear = parseInt(event.date.split("-")[0]);
      if (eventYear !== calendarYear) return false;

      if (isAcad) {
        const matchesSquadron =
          !event.targetSquadron ||
          event.targetSquadron === "ALL" ||
          Number(event.targetSquadron) === selectedYear;
        const matchesClass =
          !event.targetClass ||
          event.targetClass === "ALL" ||
          event.targetClass === selectedClass;
        const matchesCourse =
          !event.targetCourse ||
          event.targetCourse === "ALL" ||
          event.targetCourse === targetCourse;
        return matchesSquadron && matchesClass && matchesCourse;
      }

      const eventClassId = event.classId;
      const isGlobal =
        eventClassId === "Geral" ||
        eventClassId === "GLOBAL" ||
        eventClassId === "ALL";
      const isSquadronWide =
        eventClassId === `${selectedYear}ESQ` ||
        eventClassId === `${selectedYear}º Esq`;
      const isCourseWide =
        targetCourse && eventClassId === `${selectedYear}${targetCourse}`;

      return (
        isGlobal ||
        isSquadronWide ||
        isCourseWide ||
        eventClassId === targetClassId
      );
    });
  }, [classEvents, calendarYear, selectedYear, selectedClass, disciplines]);

  const handleSlotClick = (dayName: string, time: string) => {
    if (!canEdit) return;

    const dayIndex = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ].indexOf(dayName);
    if (dayIndex === -1) return;

    const date = weekDays[dayIndex];
    const dateString = formatDate(date);

    if (isSelectionMode) {
      const slotKey = `${dateString}|${time}`;
      setSelectedSlots((prev) => {
        if (prev.includes(slotKey)) {
          return prev.filter((key) => key !== slotKey);
        } else {
          return [...prev, slotKey];
        }
      });
      return;
    }

    const slot = TIME_SLOTS.find((s) => s.start === time);

    // For new event, pre-fill class ID
    // If specific class selected: '1A'
    // If ALL selected: maybe '1ESQ'? Or empty to let user choose in modal?
    // Let's pre-fill with appropriate ID if possible.
    const defaultClassId = `${selectedYear}${selectedClass}`;

    setEditingEvent({
      id: "", // Placeholder
      disciplineId: "",
      classId: defaultClassId,
      date: formatDate(date),
      startTime: time,
      endTime: slot ? slot.end : time, // Default fallback
    } as ScheduleEvent);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: ScheduleEvent) => {
    if (!canEdit) return; // View only for non-admins

    // If it's a virtual event (TFM), maybe prevent editing or handle creating a real one overlaying it?
    // for now allow click but if it has 'virtual-' prefix, handleSave logic might need adjustment if we wanted to 'instantiate' it.
    // But since we generate them dynamically, editing them doesn't make sense unless we persist them.
    // I'll allow opening but the save will create a NEW event if ID is empty/virtual?
    // Actually, updateEvent expects ID. If ID is virtual, updateEvent runs. store might complain if ID not found.
    // For now, I'll make them read-only or just letting them be.
    // The user asked to "create the discipline" and "put it in the slot".
    // Visualization is done.

    if (event.id.startsWith("virtual-")) return; // Prevent editing virtual TFM events

    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleEventDrop = (eventId: string, date: string, time: string) => {
    if (!canEdit) return;
    const targetClassId = `${selectedYear}${selectedClass}`;
    swapEvents(eventId, date, time, targetClassId);

    // Optimistically update the UI to improve perceived performance
    setClassEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const slot = TIME_SLOTS.find((s) => s.start === time);
          return {
            ...e,
            date,
            startTime: time,
            endTime: slot ? slot.end : time,
            classId: targetClassId,
          };
        }
        return e;
      }),
    );
  };

  const getSelectedEvents = () => {
    if (!selectedSlots.length) return [];
    return classEvents.filter((event) => {
      const slotKey = `${event.date}|${event.startTime}`;
      return selectedSlots.includes(slotKey);
    });
  };

  const handleBatchDelete = () => {
    const eventsToDelete = getSelectedEvents();
    const idsToDelete = eventsToDelete.map((e) => e.id);
    eventsToDelete.forEach((event) => deleteEvent(event.id));

    setClassEvents((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));

    setIsDeleteConfirmOpen(false);
    setIsSelectionMode(false);
    setSelectedSlots([]);
  };

  const handleClearWeek = () => {
    const weekDates = weekDays.map((d) => formatDate(d));
    const eventsInWeek = classEvents.filter((e) => weekDates.includes(e.date));
    const idsToDelete = eventsInWeek.map((e) => e.id);

    if (idsToDelete.length > 0) {
      deleteBatchEvents(idsToDelete);
      setClassEvents((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));
    }
    setIsClearWeekConfirmOpen(false);
  };

  const handleSave = (data: Omit<ScheduleEvent, "id">) => {
    if (isSelectionMode) {
      // Batch Save
      const newEvents: ScheduleEvent[] = [];
      const classIds = (data as any).classIds || [data.classId];

      selectedSlots.forEach((slotKey) => {
        const [date, startTime] = slotKey.split("|");

        classIds.forEach((cId: string) => {
          // Evita duplicatas no mesmo horário para a mesma turma
          const exists = classEvents.find(
            (e) =>
              e.date === date && e.startTime === startTime && e.classId === cId,
          );
          if (exists) return;

          const slot = TIME_SLOTS.find((s) => s.start === startTime);

          const newEv = {
            ...data,
            classId: cId,
            id: crypto.randomUUID(),
            date,
            startTime,
            endTime: slot ? slot.end : startTime,
          };
          addEvent(newEv);
          newEvents.push(newEv);
        });
      });

      setClassEvents((prev) => [...prev, ...newEvents]);

      // Reset selection after save
      setIsSelectionMode(false);
      setSelectedSlots([]);
    } else if (editingEvent?.id && !editingEvent.id.startsWith("virtual-")) {
      updateEvent(editingEvent.id, data);
      setClassEvents((prev) =>
        prev.map((e) => (e.id === editingEvent.id ? { ...e, ...data } : e)),
      );
    } else {
      // New Event - might have multiple classIds
      const classIds = (data as any).classIds || [data.classId];
      const newCreatedEvents: ScheduleEvent[] = [];

      classIds.forEach((cId: string) => {
        // Evita duplicatas para adição individual por turma
        const exists = classEvents.find(
          (e) =>
            e.date === data.date &&
            e.startTime === data.startTime &&
            e.classId === cId,
        );
        if (exists) return;

        const newEv = { ...data, classId: cId, id: crypto.randomUUID() };
        addEvent(newEv);
        newCreatedEvents.push(newEv);
      });

      if (newCreatedEvents.length > 0) {
        setClassEvents((prev) => [...prev, ...newCreatedEvents]);
      }
    }
    setIsEventModalOpen(false);
    setEditingEvent(undefined);
  };

  const handleExport = async (
    type: "excel" | "pdf",
    scope: "month" | "year",
  ) => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const allYearEvents = await fetchYearlyEvents(calendarYear);

      // Filter by selected squadron/class (following same logic as filteredEvents)
      const targetClassId = `${selectedYear}${selectedClass}`;
      const targetCourse = (() => {
        const letter = targetClassId.slice(1, 2).toUpperCase();
        if (["A", "B", "C", "D"].includes(letter)) return "AVIATION";
        if (letter === "E") return "INTENDANCY";
        if (letter === "F") return "INFANTRY";
        return null;
      })();

      let eventsToExport = allYearEvents.filter((event) => {
        const isAcad =
          event.type === "ACADEMIC" || event.disciplineId === "ACADEMIC";
        if (isAcad) {
          const matchesSquadron =
            !event.targetSquadron ||
            event.targetSquadron === "ALL" ||
            Number(event.targetSquadron) === selectedYear;
          const matchesClass =
            !event.targetClass ||
            event.targetClass === "ALL" ||
            event.targetClass === selectedClass;
          const matchesCourse =
            !event.targetCourse ||
            event.targetCourse === "ALL" ||
            event.targetCourse === targetCourse;
          return matchesSquadron && matchesClass && matchesCourse;
        }
        const eventClassId = event.classId;
        const isGlobal =
          eventClassId === "Geral" ||
          eventClassId === "GLOBAL" ||
          eventClassId === "ALL";
        const isSquadronWide =
          eventClassId === `${selectedYear}ESQ` ||
          eventClassId === `${selectedYear}º Esq`;
        const isCourseWide =
          targetCourse && eventClassId === `${selectedYear}${targetCourse}`;
        return (
          isGlobal ||
          isSquadronWide ||
          isCourseWide ||
          eventClassId === targetClassId
        );
      });

      if (scope === "month") {
        const currentMonth = currentDate.getMonth(); // 0-11
        eventsToExport = eventsToExport.filter(
          (e) => new Date(e.date + "T12:00:00").getMonth() === currentMonth,
        );
      }

      const squadronName = `${selectedYear}º Esquadrão ${selectedClass}`;
      const periodName =
        scope === "month"
          ? currentDate.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })
          : `Ano ${calendarYear}`;

      const fileName = `Programacao_${squadronName.replace(/\s+/g, "_")}_${periodName.replace(/\s+/g, "_")}`;

      if (type === "excel") {
        exportScheduleToExcel(eventsToExport, disciplines, fileName);
      } else {
        exportScheduleToPDF(
          eventsToExport,
          disciplines,
          fileName,
          `${squadronName} - ${periodName}`,
        );
      }
    } catch (error) {
      console.error("Erro na exportação:", error);
      alert("Falha ao exportar dados. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 md:h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1
            className={`text-3xl  tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            Programação
          </h1>
          <p
            className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            Gerencie a grade horária e alocação de disciplinas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Calendar Year Selector */}
          <div
            className={`flex items-center border rounded-lg px-3 py-2 shadow-sm ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            <span
              className={`text-sm mr-2  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Ano Letivo:
            </span>
            <select
              value={calendarYear}
              onChange={(e) => setCalendarYear(Number(e.target.value))}
              className={`bg-transparent  outline-none cursor-pointer ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
            >
              {Array.from(
                { length: 11 },
                (_, i) => new Date().getFullYear() - 5 + i,
              ).map((y) => (
                <option
                  key={y}
                  value={y}
                  className={theme === "dark" ? "bg-slate-800" : ""}
                >
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`flex p-1 rounded-lg border shadow-sm ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            {["A", "B", "C", "D", "E", "F"].map((letter) => (
              <button
                key={letter}
                onClick={() => setSelectedClass(letter)}
                className={`
                                    w-10 h-8 flex items-center justify-center text-sm  rounded-md transition-all
                                    ${
                                      selectedClass === letter
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : theme === "dark"
                                          ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                          : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
                                    }
                                `}
              >
                {letter}
              </button>
            ))}
          </div>

          <div
            className={`h-8 w-px mx-2 hidden md:block ${theme === "dark" ? "bg-slate-700" : "bg-slate-200"}`}
          ></div>

          <select
            value={selectedYear}
            onChange={(e) => {
              const val = Number(e.target.value) as CourseYear;
              setSelectedYear(val);
              setSelectedClass("A"); // Reset class on year change
            }}
            className={`border rounded-lg px-3 py-2 text-sm  shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700 text-slate-200"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            {[1, 2, 3, 4].map((year) => {
              const cohortName = getCohortNameForSquadron(year as CourseYear);
              return (
                <option
                  key={year}
                  value={year}
                  className={theme === "dark" ? "bg-slate-800" : ""}
                >
                  {year}º Esquadrão {cohortName ? `(${cohortName})` : ""}
                </option>
              );
            })}
          </select>

          {canEdit && (
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedSlots([]);
              }}
              className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg transition-colors  border
                                ${
                                  isSelectionMode
                                    ? theme === "dark"
                                      ? "bg-blue-900/40 text-blue-400 border-blue-800"
                                      : "bg-blue-100 text-blue-700 border-blue-200"
                                    : theme === "dark"
                                      ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-gray-50"
                                }
                            `}
            >
              <span className="text-sm">Selecionar Vários</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => {
                setEditingEvent(undefined);
                setIsEventModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm  ml-auto xl:ml-0"
            >
              <Plus size={20} />
              Novo Evento
            </button>
          )}

          <div
            className={`flex rounded-lg shadow-sm border ml-2 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"}`}
          >
            <button
              onClick={handlePrevWeek}
              className={`p-2 border-r rounded-l-lg transition-colors ${theme === "dark" ? "hover:bg-slate-700 border-slate-700 text-slate-400" : "hover:bg-gray-50 border-gray-200 text-slate-600"}`}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleToday}
              className={`px-4 py-2 text-sm  transition-colors ${theme === "dark" ? "hover:bg-slate-700 text-slate-300" : "hover:bg-gray-50 text-slate-700"}`}
            >
              Hoje
            </button>
            <button
              onClick={handleNextWeek}
              className={`p-2 border-l rounded-r-lg transition-colors ${theme === "dark" ? "hover:bg-slate-700 border-slate-700 text-slate-400" : "hover:bg-gray-50 border-gray-200 text-slate-600"}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm border
                                ${
                                  theme === "dark"
                                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }
                                ${isExporting ? "opacity-50 cursor-not-allowed" : ""}
                            `}
            >
              {isExporting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}
              <span className="text-sm font-medium">Exportar</span>
            </button>

            {showExportMenu && (
              <div
                className={`
                                absolute right-0 mt-2 w-56 rounded-xl shadow-xl border z-[100] overflow-hidden animate-in fade-in zoom-in duration-200
                                ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}
                            `}
              >
                <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                    Excel (XLSX)
                  </p>
                  <button
                    onClick={() => handleExport("excel", "month")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    Mês Atual
                  </button>
                  <button
                    onClick={() => handleExport("excel", "year")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    Ano Letivo {calendarYear}
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                    Documento PDF
                  </p>
                  <button
                    onClick={() => handleExport("pdf", "month")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    Mês Atual
                  </button>
                  <button
                    onClick={() => handleExport("pdf", "year")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    Ano Letivo {calendarYear}
                  </button>
                </div>
              </div>
            )}

            {/* Overlay to close menu when clicking outside */}
            {showExportMenu && (
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setShowExportMenu(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className={`flex-1 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border overflow-hidden flex flex-col ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
      >
        <CalendarGrid
          events={filteredEvents}
          disciplines={disciplines}
          weekStart={startOfWeek}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
          onEventDrop={canEdit ? handleEventDrop : undefined}
          selectionMode={isSelectionMode}
          selectedSlots={selectedSlots}
        />
      </div>

      {/* Floating Batch Action Button */}
      {isSelectionMode && selectedSlots.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col items-end gap-3">
          {getSelectedEvents().length > 0 && (
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 hover:shadow-xl transition-all  text-lg"
            >
              <Trash2 size={24} />
              Excluir {getSelectedEvents().length} Aulas
            </button>
          )}

          <button
            onClick={() => {
              // Open modal to select discipline
              setEditingEvent({
                id: "",
                disciplineId: "",
                classId: `${selectedYear}${selectedClass}`,
                startTime: "07:00", // Default, will be ignored
                endTime: "07:00", // Default
                date: new Date().toISOString().split("T")[0], // Default
              } as ScheduleEvent);
              setIsEventModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all  text-lg"
          >
            <Plus size={24} />
            Alocar {selectedSlots.length} Aulas
          </button>
        </div>
      )}

      {isEventModalOpen && (
        <EventForm
          initialData={editingEvent}
          onSubmit={handleSave}
          onDelete={(id) => {
            deleteEvent(id);
            setIsEventModalOpen(false);
            setEditingEvent(undefined);
          }}
          onCancel={() => {
            setIsEventModalOpen(false);
            setEditingEvent(undefined);
          }}
          isBatchMode={isSelectionMode}
        />
      )}

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleBatchDelete}
        title="Exclusão em Lote"
        message={`Tem certeza que deseja excluir ${getSelectedEvents().length} aulas selecionadas? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Tudo"
        cancelText="Cancelar"
        type="danger"
      />

      <ConfirmDialog
        isOpen={isClearWeekConfirmOpen}
        onClose={() => setIsClearWeekConfirmOpen(false)}
        onConfirm={handleClearWeek}
        title="Limpar Toda a Semana"
        message="ATENÇÃO: Esta ação irá excluir TODAS as aulas de TODOS os esquadrões e turmas nesta semana visível. Esta ação é irreversível. Deseja continuar?"
        confirmText="Sim, Apagar Tudo"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
