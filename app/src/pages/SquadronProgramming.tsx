import { useState, useMemo, useRef, useEffect } from "react";
import {
  Link2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Plus,
  Download,
} from "lucide-react";
import {
  exportScheduleToExcel,
  exportScheduleToPDF,
} from "../utils/exportUtils";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { CalendarGrid } from "../components/CalendarGrid";
import { EventForm } from "../components/EventForm";
import { QuickAllocationModal } from "../components/QuickAllocationModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { NoticeForm } from "../components/NoticeForm";
import { LinkChangeRequestModal } from "../components/LinkChangeRequestModal";
import {
  getStartOfWeek,
  addDays,
  formatDate,
  getWeekDays,
  formatDateForDisplay,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { ScheduleEvent, CourseYear, CohortColor } from "../types";
import { useParams, useSearchParams } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { subscribeToEventsByDateRange } from "../services/supabaseService";

export const SquadronProgramming = () => {
  const { squadronId } = useParams<{ squadronId: string }>();
  const [searchParams] = useSearchParams();
  const disciplineFilter = searchParams.get("disciplineId");
  // const navigate = useNavigate();

  const {
    disciplines,
    classes,
    cohorts,
    notices,
    addEvent,
    updateEvent,
    deleteEvent,
    deleteBatchEvents,
    swapEvents,
    addNotice,
    dataReady,
    fetchYearlyEvents,
  } = useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();

  // Initialize date from URL or default to today
  const dateParam = searchParams.get("date");
  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      const parsedDate = new Date(dateParam + "T12:00:00");
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
    return new Date();
  });

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>(
    undefined,
  );
  const [isNoticeFormOpen, setIsNoticeFormOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Validate Squadron ID (1-4)
  const currentSquadron = useMemo(() => {
    const id = parseInt(squadronId || "1");
    return id >= 1 && id <= 4 ? (id as CourseYear) : 1;
  }, [squadronId]);

  const canEdit = useMemo(() => {
    return ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || "");
  }, [userProfile]);

  // const isAdminOrCoord = useMemo(() => {
  //     return ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(userProfile?.role || '');
  // }, [userProfile]);

  // Batch Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]); // "YYYY-MM-DD|HH:mm"
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearWeekConfirmOpen, setIsClearWeekConfirmOpen] = useState(false);

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>("A");
  const [calendarYear] = useState<number>(new Date().getFullYear());
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Window Query state
  const [squadronEvents, setSquadronEvents] = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = getWeekDays(startOfWeek);
  const startDayStr = formatDate(startOfWeek);
  const endDayStr = formatDate(addDays(startOfWeek, 6));

  useEffect(() => {
    if (!dataReady) return;

    const unsubscribe = subscribeToEventsByDateRange(startDayStr, endDayStr, (data) => {
      setSquadronEvents(data as ScheduleEvent[]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [startDayStr, endDayStr, dataReady]);

  // Query all events for the year to calculate continuous counts (Offline via store)
  useEffect(() => {
    if (!dataReady) return;

    fetchYearlyEvents(calendarYear).then((data) => {
      setYearlyEvents(data);
    });
  }, [calendarYear, dataReady, fetchYearlyEvents]);

  // Helpers & Logic
  const currentCohort = useMemo(() => {
    const targetEntryYear = calendarYear - currentSquadron + 1;
    return cohorts.find((c) => Number(c.entryYear) === targetEntryYear);
  }, [calendarYear, currentSquadron, cohorts]);

  const cohortColorTokens = useMemo(() => {
    if (currentCohort?.color)
      return getCohortColorTokens(currentCohort.color as CohortColor, theme);
    return getCohortColorTokens("blue", theme);
  }, [currentCohort, theme]);

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(new Date());

  const filteredEvents = useMemo(() => {
    const targetClassId =
      selectedClass === "ALL" ? null : `${currentSquadron}${selectedClass}`;

    return squadronEvents.filter((event) => {
      const eventYear = parseInt(event.date.split("-")[0]);
      if (eventYear !== calendarYear) return false;

      const isAcademic =
        event.type === "ACADEMIC" || event.disciplineId === "ACADEMIC";
      if (
        disciplineFilter &&
        event.disciplineId !== disciplineFilter &&
        !isAcademic
      )
        return false;

      if (isAcademic) {
        const matchesSquadron =
          !event.targetSquadron ||
          event.targetSquadron === "ALL" ||
          Number(event.targetSquadron) === currentSquadron;
        const matchesClass =
          selectedClass === "ALL" ||
          !event.targetClass ||
          event.targetClass === "ALL" ||
          event.targetClass === selectedClass;

        // Course check for academic events
        let matchesCourse = true;
        if (
          event.targetCourse &&
          event.targetCourse !== "ALL" &&
          selectedClass !== "ALL"
        ) {
          const currentClassObj = classes.find(
            (c) => c.id === `${currentSquadron}${selectedClass}`,
          );
          matchesCourse = currentClassObj?.type === event.targetCourse;
        }
        return matchesSquadron && matchesClass && matchesCourse;
      }

      const eventClassId = event.classId;
      if (!eventClassId) return false;

      const isGlobal =
        eventClassId === "Geral" ||
        eventClassId === "GLOBAL" ||
        eventClassId === "ALL";

      // Check if it belongs to this squadron (year)
      const belongsToYear =
        isGlobal || eventClassId.startsWith(String(currentSquadron));
      if (!belongsToYear) return false;

      if (selectedClass === "ALL") return true;

      const isSquadronWide =
        eventClassId === `${currentSquadron}ESQ` ||
        eventClassId === `${currentSquadron}º Esq`;

      const isCourseWide =
        eventClassId.endsWith("AVIATION") ||
        eventClassId.endsWith("INTENDANCY") ||
        eventClassId.endsWith("INFANTRY");
      if (isCourseWide) {
        const courseType = eventClassId.replace(String(currentSquadron), "");
        const currentClassObj = classes.find((c) => c.id === targetClassId);
        return currentClassObj?.type === courseType;
      }

      return isGlobal || isSquadronWide || eventClassId === targetClassId;
    });
  }, [squadronEvents, currentSquadron, selectedClass, calendarYear, classes]);

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (n.targetSquadron && n.targetSquadron !== currentSquadron)
        return false;
      if (n.targetClass) {
        if (selectedClass === "ALL")
          return (
            n.targetClass.startsWith(String(currentSquadron)) ||
            n.targetClass.startsWith("COURSE:")
          );
        if (n.targetClass.startsWith("COURSE:")) {
          const requiredCourse = n.targetClass.split(":")[1];
          const currentClassObj = classes.find(
            (c) => c.id === `${currentSquadron}${selectedClass}`,
          );
          if (!currentClassObj || currentClassObj.type !== requiredCourse)
            return false;
        } else if (n.targetClass !== `${currentSquadron}${selectedClass}`)
          return false;
      }
      return true;
    });
  }, [notices, currentSquadron, selectedClass, classes]);

  const handleNoticeSubmit = (data: any) => {
    addNotice({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: userProfile?.uid || "system",
    });
    setIsNoticeFormOpen(false);
  };

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
      // If selecting a slot that has events, should we select the slot or the events?
      // In the new logic, slot clicking is for empty slots selection for batch allocation.
      setSelectedSlots((prev) =>
        prev.includes(slotKey)
          ? prev.filter((k) => k !== slotKey)
          : [...prev, slotKey],
      );
      return;
    }
    const slot = TIME_SLOTS.find((s) => s.start === time);
    const defaultClassId =
      selectedClass === "ALL"
        ? `${currentSquadron}A`
        : `${currentSquadron}${selectedClass}`;
    setEditingEvent({
      id: "",
      disciplineId: "",
      classId: defaultClassId,
      date: formatDate(date),
      startTime: time,
      endTime: slot ? slot.end : time,
    } as ScheduleEvent);
    setIsQuickModalOpen(true);
  };

  const handleEventSelect = (eventId: string) => {
    if (!isSelectionMode) return;
    setSelectedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId],
    );
  };

  const handleEventClick = (event: ScheduleEvent) => {
    if (!canEdit || event.id.startsWith("virtual-")) return;
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleEventDrop = (eventId: string, date: string, time: string) => {
    if (!canEdit) return;
    const targetClassId =
      selectedClass === "ALL"
        ? `${currentSquadron}A`
        : `${currentSquadron}${selectedClass}`;
    swapEvents(eventId, date, time, targetClassId);
  };

  const getSelectedEvents = () => {
    if (selectedEventIds.length > 0) {
      return filteredEvents.filter((event) =>
        selectedEventIds.includes(event.id),
      );
    }
    if (!selectedSlots.length) return [];
    return filteredEvents.filter((event) =>
      selectedSlots.includes(`${event.date}|${event.startTime}`),
    );
  };

  const handleBatchDelete = () => {
    const eventsToDelete = getSelectedEvents();
    const ids = eventsToDelete.map((e) => e.id);
    if (ids.length) deleteBatchEvents(ids);
    setIsDeleteConfirmOpen(false);
    setIsSelectionMode(false);
    setSelectedSlots([]);
    setSelectedEventIds([]);
  };

  const handleClearWeek = () => {
    const weekDates = weekDays.map((d) => formatDate(d));
    const ids = filteredEvents
      .filter((e) => weekDates.includes(e.date))
      .map((e) => e.id);
    if (ids.length) deleteBatchEvents(ids);
    setIsClearWeekConfirmOpen(false);
  };

  const handleSave = (data: any) => {
    const { classIds, ...eventData } = data;
    if (isSelectionMode) {
      classIds.forEach((classId: string) => {
        selectedSlots.forEach((slotKey) => {
          const [date, startTime] = slotKey.split("|");
          const slot = TIME_SLOTS.find((s) => s.start === startTime);
          addEvent({
            ...eventData,
            classId,
            id: crypto.randomUUID(),
            date,
            startTime,
            endTime: slot ? slot.end : startTime,
          });
        });
      });
      setIsSelectionMode(false);
      setSelectedSlots([]);
    } else if (editingEvent?.id && !editingEvent.id.startsWith("virtual-")) {
      updateEvent(editingEvent.id, { ...eventData, classId: classIds[0] });
    } else {
      classIds.forEach((classId: string) =>
        addEvent({ ...eventData, classId, id: crypto.randomUUID() }),
      );
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

      // Filter logic specifically for this squadron/class
      const targetClassId = `${currentSquadron}${selectedClass}`;
      const targetCourse = (() => {
        const letter = targetClassId.slice(1, 2).toUpperCase();
        if (["A", "B", "C", "D"].includes(letter)) return "AVIATION";
        if (["E"].includes(letter)) return "INTENDANCY";
        if (["F"].includes(letter)) return "INFANTRY";
        return null;
      })();

      let eventsToExport = allYearEvents.filter((event) => {
        const isAcad =
          event.type === "ACADEMIC" || event.disciplineId === "ACADEMIC";
        if (isAcad) {
          const matchesSquadron =
            !event.targetSquadron ||
            event.targetSquadron === "ALL" ||
            Number(event.targetSquadron) === currentSquadron;
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
          eventClassId === `${currentSquadron}ESQ` ||
          eventClassId === `${currentSquadron}º Esq`;
        const isCourseWide =
          targetCourse && eventClassId === `${currentSquadron}${targetCourse}`;

        return (
          isGlobal ||
          isSquadronWide ||
          isCourseWide ||
          eventClassId === targetClassId
        );
      });

      if (scope === "month") {
        const currentMonth = currentDate.getMonth();
        eventsToExport = eventsToExport.filter(
          (e) => new Date(e.date + "T12:00:00").getMonth() === currentMonth,
        );
      }

      const squadronName = `${currentSquadron}º Esquadrão ${selectedClass}`;
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

  const handleQuickSelect = (disciplineId: string) => {
    if (editingEvent)
      handleSave({
        ...editingEvent,
        disciplineId,
        classIds: [editingEvent.classId],
      });
    setIsQuickModalOpen(false);
  };

  const handleSwitchToFullForm = () => {
    setIsQuickModalOpen(false);
    setIsEventModalOpen(true);
  };

  const eventCounts = useMemo(() => {
    const counts: Record<string, { current: number; total: number }> = {};
    const groupings: Record<string, ScheduleEvent[]> = {};

    // Use yearlyEvents instead of squadronEvents for global counting
    yearlyEvents.forEach((event) => {
      if (new Date(event.date).getFullYear() !== calendarYear) return;
      const key = `${event.disciplineId}|${event.classId}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(event);
    });
    Object.values(groupings).forEach((group) => {
      if (group.length === 0) return;
      const discId = group[0].disciplineId;
      const classId = group[0].classId;
      const discipline = disciplines.find((d) => d.id === discId);
      const classObj = classes.find((c) => c.id === classId);

      let total = group.length;
      if (discipline) {
        if (classObj && classObj.type) {
          const key = `${classObj.type}_${classObj.year}`;
          if (
            discipline.ppcLoads &&
            typeof discipline.ppcLoads[key] === "number"
          ) {
            total = discipline.ppcLoads[key];
          } else {
            total = discipline.load_hours || group.length;
          }
        } else {
          total = discipline.load_hours || group.length;
        }
      }

      group
        .sort(
          (a, b) =>
            new Date(`${a.date}T${a.startTime}`).getTime() -
            new Date(`${b.date}T${b.startTime}`).getTime(),
        )
        .forEach((ev, i) => {
          counts[ev.id] = { current: i + 1, total };
        });
    });
    return counts;
  }, [yearlyEvents, calendarYear, disciplines, classes]);

  return (
    <div className="p-4 md:p-6 flex flex-col max-w-7xl mx-auto">
      <div
        className={`mb-4 flex flex-col gap-3 p-3 rounded-xl border transition-colors ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div
              className="pl-3 border-l-4"
              style={{ borderColor: cohortColorTokens.primary }}
            >
              <h1
                className={`text-xl md:text-2xl font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}
              >
                {currentSquadron}º Esquadrão{" "}
                {currentCohort && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor:
                        theme === "dark" ? "#1e293b" : cohortColorTokens.light,
                      color:
                        theme === "dark" ? "white" : cohortColorTokens.dark,
                      borderColor: cohortColorTokens.border,
                    }}
                  >
                    {currentCohort.name}
                  </span>
                )}
              </h1>
              {isLoading && (
                <Loader2 className="animate-spin text-blue-500" size={16} />
              )}
            </div>
            <div
              className={`flex h-10 p-1 rounded-xl border ${theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}
            >
              <button
                onClick={() => setSelectedClass("ALL")}
                className={`px-3 rounded-lg text-[10px] uppercase font-bold transition-all ${selectedClass === "ALL" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
              >
                Todas
              </button>
              {["A", "B", "C", "D", "E", "F"].map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedClass(l)}
                  className={`w-10 rounded-lg text-[11px] font-bold transition-all ${selectedClass === l ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center h-10 rounded-xl border p-1 shadow-sm ${theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}
            >
              <button
                onClick={handlePrevWeek}
                className="px-2 text-slate-400 hover:text-blue-500"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="px-3 text-[10px] font-bold uppercase tracking-wider"
              >
                {formatDateForDisplay(startDayStr)} -{" "}
                {formatDateForDisplay(endDayStr)}
              </button>
              <input
                ref={dateInputRef}
                type="date"
                className="absolute opacity-0 pointer-events-none"
                onChange={(e) =>
                  e.target.value &&
                  setCurrentDate(new Date(e.target.value + "T12:00:00"))
                }
                value={formatDate(currentDate)}
              />
              <button
                onClick={handleNextWeek}
                className="px-2 text-slate-400 hover:text-blue-500"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={handleToday}
              className={`h-10 px-4 border rounded-xl text-[10px] font-bold uppercase ${theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedSlots([]);
                setSelectedEventIds([]);
              }}
              className={`h-10 px-4 rounded-xl border font-bold text-[10px] uppercase transition-all ${isSelectionMode ? "bg-blue-600 text-white" : theme === "dark" ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-white text-slate-700 border-slate-200 shadow-sm"}`}
            >
              {isSelectionMode ? "Sair" : "Seleção"}
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className={`h-10 px-4 rounded-xl border font-bold text-[10px] uppercase transition-all flex items-center gap-2 ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700 shadow-sm"
                } ${isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isExporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Exportar
              </button>

              {showExportMenu && (
                <div
                  className={`
                  absolute right-0 mt-2 w-56 rounded-xl shadow-xl border z-[100] overflow-hidden animate-in fade-in zoom-in duration-200
                  ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}
                `}
                >
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                      Excel (XLSX)
                    </p>
                    <button
                      onClick={() => handleExport("excel", "month")}
                      className={`w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      Mês Atual
                    </button>
                    <button
                      onClick={() => handleExport("excel", "year")}
                      className={`w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      Ano Letivo {calendarYear}
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                      Documento PDF
                    </p>
                    <button
                      onClick={() => handleExport("pdf", "month")}
                      className={`w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      Mês Atual
                    </button>
                    <button
                      onClick={() => handleExport("pdf", "year")}
                      className={`w-full text-left px-3 py-2 text-[11px] font-medium rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      Ano Letivo {calendarYear}
                    </button>
                  </div>
                </div>
              )}

              {showExportMenu && (
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setShowExportMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`flex-1 rounded-xl shadow-lg border overflow-hidden flex flex-col relative min-h-[600px] ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
      >
        <CalendarGrid
          weekStart={startOfWeek}
          events={filteredEvents}
          notices={filteredNotices}
          disciplines={disciplines}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
          onEventDrop={canEdit ? handleEventDrop : undefined}
          selectedSlots={selectedSlots}
          selectedEventIds={selectedEventIds}
          onEventSelect={handleEventSelect}
          selectionMode={isSelectionMode}
          eventCounts={eventCounts}
        />
      </div>

      {/* Floating Action Bar */}
      {isSelectionMode &&
        (selectedSlots.length > 0 || selectedEventIds.length > 0) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="px-4 border-r border-slate-700">
              <span className="text-white text-xs font-bold whitespace-nowrap">
                {selectedEventIds.length +
                  (selectedEventIds.length === 0
                    ? selectedSlots.length
                    : 0)}{" "}
                selecionado(s)
              </span>
            </div>

            {(selectedEventIds.length > 0 ||
              (selectedSlots.length > 0 && getSelectedEvents().length > 0)) && (
              <button
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-all font-bold text-sm"
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}

            {selectedEventIds.length > 0 && (
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700 transition-all font-bold text-sm"
              >
                <Link2 size={18} />
                Vincular SAP
              </button>
            )}

            {selectedSlots.length > 0 && (
              <button
                onClick={() => {
                  setEditingEvent({
                    id: "",
                    disciplineId: "",
                    classId:
                      selectedClass === "ALL"
                        ? `${currentSquadron}A`
                        : `${currentSquadron}${selectedClass}`,
                    startTime: "07:00",
                    endTime: "07:00",
                    date: formatDate(weekDays[0]),
                  } as ScheduleEvent);
                  setIsEventModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all font-bold text-sm"
              >
                <Plus size={18} />
                Alocar em Lote
              </button>
            )}

            <button
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedSlots([]);
                setSelectedEventIds([]);
              }}
              className="px-4 py-3 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        )}

      <QuickAllocationModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSelect={handleQuickSelect}
        onMoreDetails={handleSwitchToFullForm}
        currentSquadron={currentSquadron}
        selectedClass={selectedClass}
      />

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
      {isNoticeFormOpen && (
        <NoticeForm
          initialData={{
            targetSquadron: currentSquadron as any,
            targetClass:
              selectedClass !== "ALL"
                ? `${currentSquadron}${selectedClass}`
                : undefined,
          }}
          onSubmit={handleNoticeSubmit}
          onCancel={() => setIsNoticeFormOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleBatchDelete}
        title="Exclusão em Lote"
        message={`Deseja excluir ${getSelectedEvents().length} aulas?`}
        confirmText="Excluir"
        type="danger"
      />
      <ConfirmDialog
        isOpen={isClearWeekConfirmOpen}
        onClose={() => setIsClearWeekConfirmOpen(false)}
        onConfirm={handleClearWeek}
        title="Limpar Semana"
        message="Deseja limpar todas as aulas visíveis?"
        confirmText="Limpar"
        type="danger"
      />

      {isLinkModalOpen && (
        <LinkChangeRequestModal
          selectedEventIds={selectedEventIds}
          onClose={() => {
            setIsLinkModalOpen(false);
            setIsSelectionMode(false);
            setSelectedEventIds([]);
          }}
        />
      )}
    </div>
  );
};
