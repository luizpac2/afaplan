import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MousePointer2, Link2, Trash2, X,
  Plus, Bell, CalendarDays, AlertTriangle, Info, Zap, BookOpen, ClipboardList, ChevronDown,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToEventsByDateRange, saveDocument, invalidateEventsWeekCache } from "../services/supabaseService";
import { supabase } from "../config/supabase";
import { GanttView } from "../components/GanttView";
import { EventForm } from "../components/EventForm";
import { AcademicEventForm, getAcademicColor } from "../components/AcademicEventForm";
import { NoticeForm } from "../components/NoticeForm";
import { LinkChangeRequestModal } from "../components/LinkChangeRequestModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  getStartOfWeek, addDays, formatDate, getWeekDays, formatDateForDisplay,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, CourseYear, SystemNotice } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CohortColor } from "../types";

const DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const NOTICE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  URGENT:     { bg: "bg-red-500/15 border-red-400/40",    text: "text-red-400",    icon: <AlertTriangle size={11} /> },
  WARNING:    { bg: "bg-amber-500/15 border-amber-400/40", text: "text-amber-400",  icon: <AlertTriangle size={11} /> },
  INFO:       { bg: "bg-blue-500/15 border-blue-400/40",   text: "text-blue-400",   icon: <Info size={11} /> },
  EVENT:      { bg: "bg-purple-500/15 border-purple-400/40",text: "text-purple-400",icon: <CalendarDays size={11} /> },
  EVALUATION: { bg: "bg-orange-500/15 border-orange-400/40",text: "text-orange-400",icon: <Zap size={11} /> },
  GENERAL:    { bg: "bg-slate-500/15 border-slate-400/40", text: "text-slate-400",  icon: <Info size={11} /> },
};

export const GanttProgramming = () => {
  const { squadronId } = useParams<{ squadronId: string }>();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();

  const {
    disciplines, classes, cohorts, notices,
    updateEvent, deleteBatchEvents, addNotice, updateNotice, deleteNotice, addEvent, dataReady,
    fetchYearlyEvents, unlinkEventsFromRequest,
  } = useCourseStore();

  const currentSquadron = useMemo(() => {
    const id = parseInt(squadronId || "1");
    return (id >= 1 && id <= 4 ? id : 1) as CourseYear;
  }, [squadronId]);

  const canEdit = useMemo(
    () => ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || ""),
    [userProfile]
  );

  const dateParam = searchParams.get("date");
  const sessionKey = `gantt_date_sq${currentSquadron}`;
  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      const d = new Date(dateParam + "T12:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) { const d = new Date(saved + "T12:00:00"); if (!isNaN(d.getTime())) return d; }
    } catch { /* ignora */ }
    return new Date();
  });

  // Persiste a semana atual na sessão (sem localStorage — nova aba/sessão começa em hoje)
  useEffect(() => {
    try { sessionStorage.setItem(sessionKey, formatDate(currentDate)); } catch { /* ignora */ }
  }, [currentDate, sessionKey]);

  const [weekEvents, setWeekEvents]   = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarYear] = useState(new Date().getFullYear());

  // ── Selection mode ────────────────────────────────────────────────────────
  const [isSelectionMode, setIsSelectionMode]   = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen]   = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // ── Date picker popup ─────────────────────────────────────────────────────
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const datePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".date-picker-popup")) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isDatePickerOpen]);

  // ── All-squadrons replication ─────────────────────────────────────────────
  const [allSquadronsMode, setAllSquadronsMode] = useState(false);
  const [batchAllSquadronsMode, setBatchAllSquadronsMode] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<Omit<ScheduleEvent, "id"> | null>(null);
  const [conflictEvents, setConflictEvents] = useState<ScheduleEvent[]>([]);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [pendingBatchEvents, setPendingBatchEvents] = useState<ScheduleEvent[]>([]);
  const [batchConflictEvents, setBatchConflictEvents] = useState<ScheduleEvent[]>([]);
  const [isBatchConflictDialogOpen, setIsBatchConflictDialogOpen] = useState(false);

  // ── Batch allocation mode ─────────────────────────────────────────────────
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<{ classId: string; slotIndex: number; date: string }[]>([]);
  const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);

  // ── Sidebar: notice / event creation / editing ───────────────────────────
  const [noticeFormDate, setNoticeFormDate]       = useState<string | null>(null);
  const [editingNotice, setEditingNotice]         = useState<SystemNotice | null>(null);
  const [academicFormDate, setAcademicFormDate]   = useState<string | null>(null);
  const [editingAcademic, setEditingAcademic]     = useState<ScheduleEvent | null>(null);

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays    = getWeekDays(startOfWeek);
  const startDayStr = formatDate(startOfWeek);
  const endDayStr   = formatDate(addDays(startOfWeek, 6));

  useEffect(() => {
    if (!dataReady) return;
    const unsub = subscribeToEventsByDateRange(startDayStr, endDayStr, (data) => {
      setWeekEvents(data as ScheduleEvent[]);
    });
    return () => unsub();
  }, [startDayStr, endDayStr, dataReady]);

  useEffect(() => {
    if (!dataReady) return;
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  // ── eventCounts ───────────────────────────────────────────────────────────
  const eventCounts = useMemo(() => {
    // yearlyEvents is the single source of truth for sequence numbers.
    // weekEvents is only used as fallback while yearly is still loading.
    if (yearlyEvents.length === 0) return {};

    const counts: Record<string, { current: number; total: number }> = {};
    const groupings: Record<string, ScheduleEvent[]> = {};

    yearlyEvents.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      if (new Date(ev.date).getFullYear() !== calendarYear) return;
      const groupKey = `${ev.disciplineId}|${ev.classId}`;
      if (!groupings[groupKey]) groupings[groupKey] = [];
      groupings[groupKey].push(ev);
    });

    Object.values(groupings).forEach((group) => {
      const disc = disciplines.find((d) => d.id === group[0].disciplineId);
      const cls  = classes.find((c) => c.id === group[0].classId);
      const pkKey = cls ? `${cls.type}_${cls.year}` : "";
      const total = (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) || disc?.load_hours || group.length;
      group
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
        .forEach((ev, i) => {
          counts[`${ev.classId}|${ev.date}|${ev.startTime}`] = { current: i + 1, total };
        });
    });

    // Fill any slots present in weekEvents but absent from yearlyEvents
    // (race condition: event saved after yearly query but before weekly query)
    weekEvents.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      const slotKey = `${ev.classId}|${ev.date}|${ev.startTime}`;
      if (!counts[slotKey]) {
        // Find the group to get total and approximate position
        const groupKey = `${ev.disciplineId}|${ev.classId}`;
        const group = groupings[groupKey];
        if (group) {
          const disc = disciplines.find((d) => d.id === ev.disciplineId);
          const cls  = classes.find((c) => c.id === ev.classId);
          const pkKey = cls ? `${cls.type}_${cls.year}` : "";
          const total = (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) || disc?.load_hours || group.length;
          // Insert this event into the sorted group to find its position
          const allWithThis = [...group, ev].sort(
            (a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)
          );
          const pos = allWithThis.findIndex(e => `${e.classId}|${e.date}|${e.startTime}` === slotKey);
          counts[slotKey] = { current: pos + 1, total };
        }
      }
    });

    return counts;
  }, [yearlyEvents, weekEvents, calendarYear, disciplines, classes]);

  const squadronClasses = useMemo(() => {
    const prefix = String(currentSquadron);
    const fromEvents = [...new Set(weekEvents.filter((e) => e.classId?.startsWith(prefix) && !e.classId.endsWith("ESQ")).map((e) => e.classId))].sort();
    if (fromEvents.length) return fromEvents;
    return ["A","B","C","D","E","F"].map((l) => `${currentSquadron}${l}`);
  }, [weekEvents, currentSquadron]);

  const cohortColorTokens = useMemo(() => {
    const targetEntryYear = calendarYear - currentSquadron + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === targetEntryYear);
    return getCohortColorTokens((cohort?.color || "blue") as CohortColor);
  }, [cohorts, calendarYear, currentSquadron]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleEventClick = (ev: ScheduleEvent) => {
    if (!canEdit) return;
    console.log("[handleEventClick] id:", JSON.stringify(ev.id), "classId:", ev.classId, "date:", ev.date, "startTime:", ev.startTime);
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSlotDrop = (ev: ScheduleEvent, newSlotIndex: number) => {
    const newSlot = TIME_SLOTS[newSlotIndex];
    if (!newSlot) return;
    updateEvent(ev.id, { startTime: newSlot.start, endTime: newSlot.end });
  };

  const handleEmptySlotClick = (classId: string, slotIndex: number, date: string) => {
    if (!canEdit) return;
    const slot = TIME_SLOTS[slotIndex];
    setEditingEvent({
      id: "",
      disciplineId: "",
      classId,
      date,
      startTime: slot?.start || "07:00",
      endTime: slot?.end || "08:00",
      type: "CLASS",
    });
    setIsModalOpen(true);
  };

  const handleSlotSelect = (classId: string, slotIndex: number, date: string) => {
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.classId === classId && s.slotIndex === slotIndex && s.date === date);
      return exists
        ? prev.filter((s) => !(s.classId === classId && s.slotIndex === slotIndex && s.date === date))
        : [...prev, { classId, slotIndex, date }];
    });
  };

  const doSaveBatchEvents = (events: ScheduleEvent[], overwriteConflicts: boolean) => {
    if (overwriteConflicts) {
      batchConflictEvents.forEach((c) => {
        useCourseStore.getState().deleteEvent(c.id);
        setWeekEvents((prev) => prev.filter((e) => e.id !== c.id));
      });
    }
    const toSave = overwriteConflicts
      ? events
      : events.filter((ev) => !batchConflictEvents.some(
          (c) => c.classId === ev.classId && c.date === ev.date && c.startTime === ev.startTime
        ));
    toSave.forEach((ev) => addEvent(ev));
    setWeekEvents((prev) => [...prev, ...toSave]);
    setIsBatchFormOpen(false);
    setIsBatchMode(false);
    setSelectedSlots([]);
    setBatchAllSquadronsMode(false);
    setPendingBatchEvents([]);
    setBatchConflictEvents([]);
  };

  const handleBatchAllocate = (data: Omit<ScheduleEvent, "id">) => {
    // Eventos do esquadrão atual
    const baseEvents: ScheduleEvent[] = selectedSlots.map(({ classId, slotIndex, date }) => {
      const slot = TIME_SLOTS[slotIndex];
      return { ...data, id: crypto.randomUUID(), classId, date, startTime: slot?.start || data.startTime, endTime: slot?.end || data.endTime };
    });

    if (!batchAllSquadronsMode) {
      baseEvents.forEach((ev) => addEvent(ev));
      setWeekEvents((prev) => [...prev, ...baseEvents]);
      setIsBatchFormOpen(false);
      setIsBatchMode(false);
      setSelectedSlots([]);
      return;
    }

    // Replica para os outros esquadrões
    const otherSquadrons = ([1, 2, 3, 4] as CourseYear[]).filter((s) => s !== currentSquadron);
    const replicaEvents: ScheduleEvent[] = [];
    otherSquadrons.forEach((sq) => {
      selectedSlots.forEach(({ classId, slotIndex, date }) => {
        const slot = TIME_SLOTS[slotIndex];
        const suffix = classId.replace(String(currentSquadron), "");
        const targetClassId = `${sq}${suffix}`;
        replicaEvents.push({
          ...data,
          id: crypto.randomUUID(),
          classId: targetClassId,
          targetSquadron: sq,
          date,
          startTime: slot?.start || data.startTime,
          endTime: slot?.end || data.endTime,
        });
      });
    });

    const allEvents = [...baseEvents, ...replicaEvents];
    const conflicts = allEvents.filter((ev) =>
      weekEvents.some((e) => e.classId === ev.classId && e.date === ev.date && e.startTime === ev.startTime
        && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC")
    );

    if (conflicts.length > 0) {
      setPendingBatchEvents(allEvents);
      setBatchConflictEvents(
        weekEvents.filter((e) => conflicts.some(
          (c) => c.classId === e.classId && c.date === e.date && c.startTime === e.startTime
        ))
      );
      setIsBatchConflictDialogOpen(true);
    } else {
      doSaveBatchEvents(allEvents, false);
    }
  };

  const handleBatchDelete = () => {
    if (selectedEventIds.length) {
      deleteBatchEvents(selectedEventIds);
      setWeekEvents((prev) => prev.filter((e) => !selectedEventIds.includes(e.id)));
    }
    setIsDeleteConfirmOpen(false);
    setIsSelectionMode(false);
    setSelectedEventIds([]);
  };

  const selectedHaveSap = selectedEventIds.some(
    (id) => weekEvents.find((e) => e.id === id)?.changeRequestId
  );

  const handleUnlink = async () => {
    await unlinkEventsFromRequest(selectedEventIds);
    setWeekEvents((prev) =>
      prev.map((e) =>
        selectedEventIds.includes(e.id)
          ? { ...e, changeRequestId: undefined }
          : e
      )
    );
    setIsSelectionMode(false);
    setSelectedEventIds([]);
  };

  const [evalDropdownOpen, setEvalDropdownOpen] = useState(false);
  const evalDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!evalDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!evalDropdownRef.current?.contains(e.target as Node)) setEvalDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [evalDropdownOpen]);

  const EVAL_CONVERT_OPTIONS = [
    { type: "PARTIAL",       label: "Parcial" },
    { type: "EXAM",          label: "Exame" },
    { type: "FINAL",         label: "Final" },
    { type: "SECOND_CHANCE", label: "2ª Época" },
    { type: "REVIEW",        label: "Vista" },
  ] as const;

  const handleConvertToEvaluation = (evalType: typeof EVAL_CONVERT_OPTIONS[number]["type"]) => {
    selectedEventIds.forEach((id) => {
      const ev = weekEvents.find((e) => e.id === id);
      if (!ev || ev.type === "ACADEMIC") return;
      updateEvent(id, { type: "EVALUATION", evaluationType: evalType });
    });
    setWeekEvents((prev) =>
      prev.map((e) =>
        selectedEventIds.includes(e.id) && e.type !== "ACADEMIC"
          ? { ...e, type: "EVALUATION", evaluationType: evalType }
          : e
      )
    );
    setEvalDropdownOpen(false);
    setIsSelectionMode(false);
    setSelectedEventIds([]);
  };

  const handleNoticeSubmit = (data: Partial<SystemNotice>) => {
    addNotice({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: userProfile?.uid || "system",
    } as SystemNotice);
    setNoticeFormDate(null);
  };

  const handleNoticeUpdate = (data: Partial<SystemNotice>) => {
    if (!editingNotice) return;
    updateNotice(editingNotice.id, data);
    setEditingNotice(null);
  };

  const handleNoticeDelete = () => {
    if (!editingNotice) return;
    deleteNotice(editingNotice.id);
    setEditingNotice(null);
  };

  const handleAcademicSubmit = (data: Omit<ScheduleEvent, "id">) => {
    const id = crypto.randomUUID();
    const newEvent = { ...data, id };
    addEvent(newEvent);
    setWeekEvents((prev) => [...prev, newEvent]);

    // Persiste no banco com payload controlado
    const dbPayload: Record<string, any> = {
      id,
      date:           data.date,
      startTime:      data.startTime ?? null,
      endTime:        data.endTime ?? null,
      description:    data.description ?? null,
      notes:          (data as any).notes ?? null,
      endDate:        (data as any).endDate ?? null,
      location:       data.location ?? null,
      targetSquadron: data.targetSquadron != null ? String(data.targetSquadron) : null,
      targetCourse:   data.targetCourse ?? null,
      targetClass:    data.targetClass ?? null,
      type:           data.type ?? null,
      disciplineId:   data.disciplineId,
      classId:        data.classId,
      color:          data.color ?? null,
    };
    saveDocument("programacao_aulas", id, dbPayload)
      .catch((err) => console.error("[AcademicSave] DB error:", err));

    setAcademicFormDate(null);
  };

  const handleAcademicUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingAcademic) return;

    // Campos seguros conhecidos na tabela + novos campos acadêmicos
    const dbPayload: Record<string, any> = {
      date:            data.date,
      startTime:       data.startTime ?? null,
      endTime:         data.endTime ?? null,
      description:     data.description ?? null,
      notes:           (data as any).notes ?? null,
      endDate:         (data as any).endDate ?? null,
      location:        data.location ?? null,
      targetSquadron:  data.targetSquadron != null ? String(data.targetSquadron) : null,
      targetCourse:    data.targetCourse ?? null,
      targetClass:     data.targetClass ?? null,
      type:            data.type ?? null,
      color:           data.color ?? null,
    };

    // Atualiza estado local imediatamente (sem chamar updateEvent que dispara seu próprio updateDocument)
    const merged = { ...editingAcademic, ...data };
    setWeekEvents((prev) =>
      prev.map((e) => e.id === editingAcademic.id ? merged : e)
    );
    useCourseStore.setState((s) => ({
      events: s.events.map((e) => e.id === editingAcademic.id ? merged : e),
    }));

    // Persiste via edge function (service role, bypassa RLS)
    supabase.functions
      .invoke("admin-manage-content", { body: { action: "update_event", id: editingAcademic.id, updates: dbPayload } })
      .then(({ error }) => {
        if (error) console.error("[AcademicUpdate] edge error:", error.message);
        else console.log("[AcademicUpdate] salvo:", dbPayload);
      });

    setEditingAcademic(null);
  };

  const handleAcademicDelete = (id: string) => {
    useCourseStore.getState().deleteEvent(id);
    setWeekEvents((prev) => prev.filter((e) => e.id !== id));
    setEditingAcademic(null);
  };

  // ── Sidebar notices & academic events per day ─────────────────────────────
  const dayNotices = (dateStr: string) =>
    notices.filter((n) => {
      if (dateStr < n.startDate || dateStr > n.endDate) return false;
      if (n.targetSquadron && Number(n.targetSquadron) !== currentSquadron) return false;
      return true;
    });

  const ACADEMIC_TYPES = new Set(["ACADEMIC", "EVALUATION", "COMMEMORATIVE", "SPORTS", "INFORMATIVE", "HOLIDAY"]);
  const dayAcademic = (dateStr: string) =>
    weekEvents.filter((e) => {
      if (!ACADEMIC_TYPES.has(e.type ?? "") && e.disciplineId !== "ACADEMIC") return false;
      const end = (e as any).endDate ?? e.date;
      if (dateStr < e.date || dateStr > end) return false;
      // For EVALUATION events, filter by squadron derived from classId (e.g. "4A" → 4)
      if (e.type === "EVALUATION") {
        const evSq = e.classId ? parseInt(e.classId.charAt(0)) : NaN;
        if (!isNaN(evSq) && evSq !== currentSquadron) return false;
        return true;
      }
      const ts = e.targetSquadron;
      if (ts !== "ALL" && ts != null && Number(ts) !== currentSquadron) return false;
      return true;
    });

  // Day Off events that affect this squadron on a given date
  const dayOff = (dateStr: string) =>
    weekEvents.filter((e) => {
      if (e.type !== "DAY_OFF") return false;
      const end = (e as any).endDate ?? e.date;
      if (dateStr < e.date || dateStr > end) return false;
      const ts = e.targetSquadron;
      if (ts !== "ALL" && ts != null && Number(ts) !== currentSquadron) return false;
      return true;
    });

  // Salva o evento no esquadrão atual + replica para os outros 3 se allSquadronsMode
  const doSaveEvent = (data: Omit<ScheduleEvent, "id">, overwriteConflicts: boolean) => {
    const otherSquadrons = ([1, 2, 3, 4] as CourseYear[]).filter((s) => s !== currentSquadron);

    const saveOne = (eventData: Omit<ScheduleEvent, "id">, existingId?: string) => {
      console.log("[doSaveEvent] saveOne existingId:", existingId, "disciplineId:", eventData.disciplineId, "type:", eventData.type, "classId:", eventData.classId, "date:", eventData.date, "startTime:", eventData.startTime);
      if (existingId) {
        updateEvent(existingId, eventData);
        setWeekEvents((prev) => {
          const found = prev.some((e) => e.id === existingId);
          if (!found) console.warn("[doSaveEvent] id não encontrado em weekEvents:", existingId, "total:", prev.length);
          return prev.map((e) => e.id === existingId ? { ...e, ...eventData } : e);
        });
      } else {
        const newEvent: ScheduleEvent = { ...eventData, id: crypto.randomUUID() };
        addEvent(newEvent);
        setWeekEvents((prev) => [...prev, newEvent]);
      }
    };

    // Salva o evento principal (esquadrão atual)
    if (editingEvent?.id) {
      saveOne(data, editingEvent.id);
    } else {
      saveOne(data);
    }

    // Replica para os outros esquadrões
    if (allSquadronsMode) {
      otherSquadrons.forEach((sq) => {
        // Mapeia classId: substitui o número do esquadrão atual pelo destino
        const origClass = data.classId || "";
        const suffix = origClass.replace(String(currentSquadron), "");
        const targetClassId = `${sq}${suffix}`;

        const replicaData: Omit<ScheduleEvent, "id"> = {
          ...data,
          classId: targetClassId,
          targetSquadron: sq,
        };

        if (overwriteConflicts) {
          // Apaga conflito existente antes de inserir
          const conflict = conflictEvents.find(
            (e) => e.classId === targetClassId && e.date === data.date && e.startTime === data.startTime
          );
          if (conflict?.id) {
            useCourseStore.getState().deleteEvent(conflict.id);
            setWeekEvents((prev) => prev.filter((e) => e.id !== conflict.id));
          }
        }

        const existingInSlot = weekEvents.find(
          (e) => e.classId === targetClassId && e.date === data.date && e.startTime === data.startTime && e.id
        );
        if (existingInSlot && !overwriteConflicts) return; // pula se não deve sobrescrever

        saveOne(replicaData, overwriteConflicts && existingInSlot ? existingInSlot.id : undefined);
      });
    }

    setIsModalOpen(false);
    setEditingEvent(undefined);
    setAllSquadronsMode(false);
    setPendingSubmitData(null);
    setConflictEvents([]);
  };

  const handleEventSubmit = (data: Omit<ScheduleEvent, "id">) => {
    // Sempre verifica conflito no esquadrão atual (exceto ao editar o próprio evento)
    const selfConflict = weekEvents.find(
      (e) => e.classId === data.classId && e.date === data.date && e.startTime === data.startTime
        && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"
        && e.id !== editingEvent?.id
    );

    if (!allSquadronsMode) {
      if (selfConflict) {
        setPendingSubmitData(data);
        setConflictEvents([selfConflict]);
        setIsConflictDialogOpen(true);
      } else {
        doSaveEvent(data, false);
      }
      return;
    }

    // Verifica conflitos no esquadrão atual + outros esquadrões
    const conflicts: ScheduleEvent[] = selfConflict ? [selfConflict] : [];
    const otherSquadrons = ([1, 2, 3, 4] as CourseYear[]).filter((s) => s !== currentSquadron);
    otherSquadrons.forEach((sq) => {
      const origClass = data.classId || "";
      const suffix = origClass.replace(String(currentSquadron), "");
      const targetClassId = `${sq}${suffix}`;
      const conflict = weekEvents.find(
        (e) => e.classId === targetClassId && e.date === data.date && e.startTime === data.startTime
          && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC"
      );
      if (conflict) conflicts.push(conflict);
    });

    if (conflicts.length > 0) {
      setPendingSubmitData(data);
      setConflictEvents(conflicts);
      setIsConflictDialogOpen(true);
    } else {
      doSaveEvent(data, false);
    }
  };

  const selectAllSlotsForDay = (dateStr: string) => {
    const slots: { classId: string; slotIndex: number; date: string }[] = [];
    for (const classId of squadronClasses) {
      for (let si = 0; si < TIME_SLOTS.length; si++) {
        slots.push({ classId, slotIndex: si, date: dateStr });
      }
    }
    setSelectedSlots((prev) => {
      const existing = new Set(prev.map((s) => `${s.classId}|${s.slotIndex}|${s.date}`));
      const toAdd = slots.filter((s) => !existing.has(`${s.classId}|${s.slotIndex}|${s.date}`));
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev.filter((s) => s.date !== dateStr);
    });
  };

  const selectAllSlotsForWeek = () => {
    const allSlots: { classId: string; slotIndex: number; date: string }[] = [];
    for (const day of weekDays.slice(0, 6)) {
      const dateStr = formatDate(day);
      if (dayOff(dateStr).length > 0) continue;
      for (const classId of squadronClasses) {
        for (let si = 0; si < TIME_SLOTS.length; si++) {
          allSlots.push({ classId, slotIndex: si, date: dateStr });
        }
      }
    }
    setSelectedSlots(allSlots);
  };

  const selectAllEventsForDay = (dateStr: string) => {
    const ids = weekEvents
      .filter((e) => e.date === dateStr && e.type !== "ACADEMIC" && e.type !== "DAY_OFF" && e.classId?.startsWith(String(currentSquadron)))
      .map((e) => e.id);
    setSelectedEventIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  };

  const selectAllEventsForWeek = () => {
    const ids = weekEvents
      .filter((e) => e.type !== "ACADEMIC" && e.type !== "DAY_OFF" && e.classId?.startsWith(String(currentSquadron)))
      .map((e) => e.id);
    setSelectedEventIds(ids);
  };

  const [deduplicating, setDeduplicating] = useState(false);
  const handleDeduplicateWeek = async () => {
    setDeduplicating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-content", {
        body: { action: "deduplicate_events", startDate: startDayStr, endDate: endDayStr },
      });
      if (error) { alert(`Erro: ${error.message}`); return; }
      console.log("deduplicate_events result:", data);
      if (data?.deleted > 0) {
        alert(`✅ ${data.deleted} aula(s) duplicada(s) removida(s) da semana.`);
        // Invalida cache e recarrega
        invalidateEventsWeekCache();
        subscribeToEventsByDateRange(startDayStr, endDayStr, (evs) => setWeekEvents(evs as ScheduleEvent[]));
      } else {
        const detail = data?.totalRaw != null ? ` (${data.totalRaw} eventos no banco, nenhum duplicado por slot)` : "";
        alert(`Nenhuma duplicata encontrada nesta semana.${detail}`);
      }
    } catch (e) {
      alert("Erro ao limpar duplicatas.");
    } finally {
      setDeduplicating(false);
    }
  };

  const today  = formatDate(new Date());
  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const text   = isDark ? "text-slate-100" : "text-slate-800";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";
  const sidebarBg = isDark ? "bg-slate-900/60" : "bg-slate-50/80";

  return (
    <div className="flex flex-col max-w-[1600px] mx-auto">

      {/* ── Sticky Toolbar ────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 md:px-6 py-3 border-b shadow-sm ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: cohortColorTokens.primary }} />
          <div>
            <h1 className={`text-base font-bold ${text}`}>{currentSquadron}º Esquadrão — Programação Semanal</h1>
            <p className={`text-xs ${muted}`}>
              {formatDateForDisplay(formatDate(startOfWeek))} – {formatDateForDisplay(formatDate(addDays(startOfWeek, 4)))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && !isSelectionMode && !isBatchMode && (
            <button
              onClick={() => setIsBatchMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-green-400 text-green-600`}
            >
              <Plus size={13} /> Alocar em Lote
            </button>
          )}
          {canEdit && isBatchMode && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${muted}`}>{selectedSlots.length} slot(s)</span>
              <button onClick={selectAllSlotsForWeek}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-green-400 text-green-600`}>
                ☑ Semana
              </button>
              <button
                onClick={() => { if (selectedSlots.length > 0) setIsBatchFormOpen(true); }}
                disabled={selectedSlots.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-green-600 border-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
              >
                <Plus size={13} /> Alocar
              </button>
              <button onClick={() => { setIsBatchMode(false); setSelectedSlots([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}>
                <X size={13} /> Cancelar
              </button>
            </div>
          )}
          {canEdit && !isSelectionMode && !isBatchMode && (
            <button
              onClick={() => setIsSelectionMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}
            >
              <MousePointer2 size={13} /> Selecionar
            </button>
          )}
          {userProfile?.role === "SUPER_ADMIN" && !isSelectionMode && !isBatchMode && (
            <button
              onClick={handleDeduplicateWeek}
              disabled={deduplicating}
              title="Remove aulas duplicadas no mesmo slot desta semana"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-orange-400 text-orange-500 disabled:opacity-40`}
            >
              🧹 {deduplicating ? "Limpando..." : "Duplicatas"}
            </button>
          )}
          {canEdit && isSelectionMode && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${muted}`}>{selectedEventIds.length} selecionado(s)</span>
              <button onClick={selectAllEventsForWeek}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}>
                ☑ Semana
              </button>
              <button onClick={() => setIsLinkModalOpen(true)} disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-blue-600 border-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors">
                <Link2 size={13} /> Vincular SAP
              </button>
              {selectedHaveSap && (
                <button onClick={handleUnlink} disabled={selectedEventIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-orange-500 border-orange-400 hover:bg-orange-500/10 disabled:opacity-40 transition-colors">
                  <Link2 size={13} /> Desvincular
                </button>
              )}
              <div ref={evalDropdownRef} className="relative">
                <button
                  onClick={() => setEvalDropdownOpen((o) => !o)}
                  disabled={selectedEventIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-amber-500 border-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors"
                >
                  <ClipboardList size={13} /> Avaliação <ChevronDown size={11} />
                </button>
                {evalDropdownOpen && (
                  <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[130px] ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                    {EVAL_CONVERT_OPTIONS.map(({ type, label }) => (
                      <button
                        key={type}
                        onClick={() => handleConvertToEvaluation(type)}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${isDark ? "hover:bg-slate-700 text-slate-200" : "hover:bg-amber-50 text-slate-700"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setIsDeleteConfirmOpen(true)} disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-red-500 border-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
                <Trash2 size={13} /> Excluir
              </button>
              <button onClick={() => { setIsSelectionMode(false); setSelectedEventIds([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}>
                <X size={13} /> Cancelar
              </button>
            </div>
          )}
          <button onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
            <ChevronLeft size={16} className={muted} />
          </button>
          <div className="relative">
            <button
              onClick={() => {
                setPickerMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                setIsDatePickerOpen((v) => !v);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}>
              Calendário
            </button>
            {isDatePickerOpen && (
              <div ref={datePickerRef} className={`date-picker-popup absolute right-0 mt-1 z-50 rounded-xl border shadow-xl p-3 w-64 ${isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}>
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}
                      className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}>
                      <ChevronLeft size={14} />
                    </button>
                    <span className={`text-xs font-semibold ${text}`}>
                      {pickerMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}
                      className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {["D","S","T","Q","Q","S","S"].map((d, i) => (
                      <div key={i} className={`text-center text-[10px] font-bold ${muted}`}>{d}</div>
                    ))}
                  </div>
                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {(() => {
                      const year = pickerMonth.getFullYear();
                      const month = pickerMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const todayStr = formatDate(new Date());
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const cells: any[] = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const date = new Date(year, month, d);
                        const dateStr = formatDate(date);
                        const isT = dateStr === todayStr;
                        const isSel = formatDate(getStartOfWeek(currentDate)) === formatDate(getStartOfWeek(date));
                        cells.push(
                          <button key={d}
                            onClick={() => { setCurrentDate(date); setIsDatePickerOpen(false); }}
                            className={`text-[11px] h-7 w-full rounded transition-colors font-medium
                              ${isT ? "bg-blue-500 text-white" : isSel ? (isDark ? "bg-slate-600 text-slate-100" : "bg-slate-200 text-slate-800") : `hover:bg-blue-500/15 ${text}`}`}>
                            {d}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  {/* Go to today shortcut */}
                  <button
                    onClick={() => { setCurrentDate(new Date()); setIsDatePickerOpen(false); }}
                    className="mt-2 w-full text-[11px] py-1 rounded-lg border border-blue-400/50 text-blue-500 hover:bg-blue-500/10 transition-colors font-medium">
                    Ir para hoje
                  </button>
                </div>
            )}
          </div>
          <button onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
            <ChevronRight size={16} className={muted} />
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6 flex flex-col gap-4">

      {/* ── One card per work day ──────────────────────────────────────────── */}
      {weekDays.slice(0, 6).map((day, i) => {
        if (!day) return null;
        const dateStr  = formatDate(day);
        const isToday  = dateStr === today;
        const dayNum   = day.getDate();
        const monthShort = day.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        const notices_  = dayNotices(dateStr);
        const academic_ = dayAcademic(dateStr);
        const dayOff_   = dayOff(dateStr);
        const isDayOff  = dayOff_.length > 0;
        const hasSidebar = notices_.length > 0 || academic_.length > 0 || isDayOff || canEdit;

        return (
          <div key={dateStr}
            className={`rounded-xl border overflow-hidden ${card} ${isToday ? "ring-2 ring-blue-500/40" : ""} ${isDayOff ? "ring-2 ring-red-500/40" : ""}`}>

            {/* Day Off banner */}
            {isDayOff && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-b border-red-500/20">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">⛔ Day Off</span>
                <span className="text-[10px] text-red-400/80 truncate">{dayOff_[0].description || "Dia sem aulas"}</span>
              </div>
            )}

            {/* Day header */}
            <div className={`flex items-center gap-3 px-4 py-2 border-b ${border} ${isToday ? (isDark ? "bg-blue-900/20" : "bg-blue-50/50") : ""}`}>
              <span className={`text-xs font-semibold uppercase ${isToday ? "text-blue-500" : muted}`}>{DAYS_SHORT[i]}</span>
              <span className={`text-sm font-bold ${isToday ? "text-blue-500" : text}`}>{dayNum} {monthShort}.</span>
              {isToday && <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">HOJE</span>}
              <span className={`text-xs ${muted}`}>
                {weekEvents.filter(e => e.date === dateStr && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC" && e.classId?.startsWith(String(currentSquadron))).length} aula(s)
              </span>
              <div className="flex gap-1 ml-auto items-center">
                {canEdit && isBatchMode && !isDayOff && (
                  <button
                    onClick={() => selectAllSlotsForDay(dateStr)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                      selectedSlots.some((s) => s.date === dateStr)
                        ? "bg-green-500/20 border-green-400 text-green-600"
                        : `${card} hover:border-green-400 text-green-600`
                    }`}
                    title="Selecionar/desselecionar todos os slots deste dia"
                  >
                    ☑ Dia
                  </button>
                )}
                {canEdit && isSelectionMode && !isDayOff && (
                  <button
                    onClick={() => selectAllEventsForDay(dateStr)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                      weekEvents.filter((e) => e.date === dateStr && e.type !== "ACADEMIC" && e.type !== "DAY_OFF" && e.classId?.startsWith(String(currentSquadron))).every((e) => selectedEventIds.includes(e.id))
                        ? "bg-blue-500/20 border-blue-400 text-blue-600"
                        : `${card} hover:border-blue-400 text-blue-600`
                    }`}
                    title="Selecionar/desselecionar todos os eventos deste dia"
                  >
                    ☑ Dia
                  </button>
                )}
                {notices_.length > 0 && (
                  <>
                    {notices_.slice(0, 3).map((n) => (
                      <span key={n.id} title={n.description}
                        className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                        {n.title}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Body: Gantt + Sidebar — row on desktop, column on mobile */}
            <div className="flex flex-col md:flex-row">
              {/* Gantt — ocupa largura disponível */}
              <div className="flex-1 min-w-0 overflow-hidden px-2 py-2">
                <GanttView
                  date={dateStr}
                  events={weekEvents}
                  disciplines={disciplines}
                  classes={squadronClasses}
                  onEventClick={handleEventClick}
                  eventCounts={eventCounts}
                  canEdit={canEdit}
                  selectedEventIds={selectedEventIds}
                  onSelectEvent={handleSelectEvent}
                  isSelectionMode={isSelectionMode}
                  onSlotDrop={handleSlotDrop}
                  onEmptySlotClick={!isBatchMode && !isDayOff ? handleEmptySlotClick : undefined}
                  isBatchMode={isBatchMode && !isDayOff}
                  selectedSlots={selectedSlots}
                  onSlotSelect={!isDayOff ? handleSlotSelect : undefined}
                  onDeleteEvent={(id) => useCourseStore.getState().deleteEvent(id)}
                />
              </div>

              {/* Sidebar — à direita no desktop, abaixo no mobile */}
              {hasSidebar && (
                <div className={`border-t md:border-t-0 md:border-l ${border} ${sidebarBg} flex flex-col w-full md:w-52 md:flex-shrink-0`}>

                  {/* Avisos */}
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                        <Bell size={10} /> Avisos
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => setNoticeFormDate(dateStr)}
                          className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                          title="Criar aviso"
                        >
                          <Plus size={10} /> Novo
                        </button>
                      )}
                    </div>

                    {notices_.length === 0 ? (
                      <p className={`text-[10px] italic ${muted} opacity-60`}>Sem avisos</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {notices_.map((n) => {
                          const style = NOTICE_STYLES[n.type] || NOTICE_STYLES.GENERAL;
                          return (
                            <div key={n.id}
                              onClick={canEdit ? () => setEditingNotice(n) : undefined}
                              className={`rounded-lg border px-2 py-1.5 ${style.bg} ${canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
                              <div className={`flex items-center gap-1 ${style.text} font-semibold text-[10px] leading-tight`}>
                                {style.icon}
                                <span className="truncate">{n.title}</span>
                              </div>
                              {n.description && (
                                <p className={`text-[9px] leading-tight mt-0.5 ${muted}`}>
                                  {n.description}
                                </p>
                              )}
                              {n.startDate !== n.endDate && (() => {
                                const totalDays = Math.round((new Date(n.endDate).getTime() - new Date(n.startDate).getTime()) / 86400000) + 1;
                                const dayIdx = Math.round((new Date(dateStr).getTime() - new Date(n.startDate).getTime()) / 86400000) + 1;
                                return (
                                  <div className="flex items-end justify-between mt-0.5">
                                    <p className={`text-[8px] ${muted} opacity-70`}>até {n.endDate}</p>
                                    <span className={`text-[9px] font-bold px-1 rounded ${isDark ? "bg-slate-600 text-slate-200" : "bg-slate-200 text-slate-600"}`}>{dayIdx}/{totalDays}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={`mx-3 border-t ${border}`} />

                  {/* Eventos do dia (ACADEMIC) */}
                  <div className="px-3 pt-2 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                        <BookOpen size={10} /> Eventos
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => setAcademicFormDate(dateStr)}
                          className="text-[10px] text-purple-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                          title="Criar evento acadêmico"
                        >
                          <Plus size={10} /> Novo
                        </button>
                      )}
                    </div>

                    {academic_.length === 0 ? (
                      <p className={`text-[10px] italic ${muted} opacity-60`}>Sem eventos</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {/* Agrupa avaliações por disciplina+tipo, demais eventos aparecem normalmente */}
                        {(() => {
                          const evalMap = new Map<string, { ev: typeof academic_[0]; turmas: string[] }>();
                          const others: typeof academic_ = [];
                          for (const ev of academic_) {
                            if (ev.type === "EVALUATION") {
                              const key = `${ev.disciplineId}|${ev.evaluationType || ""}`;
                              if (!evalMap.has(key)) evalMap.set(key, { ev, turmas: [] });
                              if (ev.classId && !evalMap.get(key)!.turmas.includes(ev.classId))
                                evalMap.get(key)!.turmas.push(ev.classId);
                            } else {
                              others.push(ev);
                            }
                          }
                          const EVAL_LABELS: Record<string, string> = {
                            PARTIAL: "Av. Parcial", EXAM: "Exame", FINAL: "Av. Final",
                            SECOND_CHANCE: "2ª Chamada", REVIEW: "Vista",
                          };
                          return (
                            <>
                              {[...evalMap.values()].map(({ ev, turmas }) => {
                                const disc = disciplines.find((d) => d.id === ev.disciplineId);
                                const code = disc?.code || ev.disciplineId;
                                const evalLabel = EVAL_LABELS[ev.evaluationType || ""] || "Avaliação";
                                turmas.sort();
                                return (
                                  <div
                                    key={`eval-${ev.disciplineId}-${ev.evaluationType}`}
                                    className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-1.5"
                                  >
                                    <p className="text-[10px] font-bold leading-tight text-orange-500">
                                      {code} — {evalLabel}
                                    </p>
                                    <div className="flex flex-wrap gap-[3px] mt-1">
                                      {turmas.map((t) => (
                                        <span key={t} className="text-[8px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-1">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {others.map((ev) => {
                                const col = getAcademicColor(ev.targetSquadron, isDark);
                                return (
                                  <div
                                    key={ev.id}
                                    className={`rounded-lg border ${col.border} ${col.bg} px-2 py-1.5 transition-colors ${canEdit ? `cursor-pointer ${col.hover}` : ""}`}
                                    onClick={() => canEdit && setEditingAcademic(ev)}
                                    title={canEdit ? "Clique para editar" : undefined}
                                  >
                                    <p className={`text-[10px] font-semibold leading-tight ${col.title}`}>
                                      {ev.description || ev.location || "Evento acadêmico"}
                                    </p>
                                    {(ev as any).notes && (
                                      <p className={`text-[9px] mt-0.5 leading-snug ${col.sub}`}>
                                        {(ev as any).notes}
                                      </p>
                                    )}
                                    {ev.startTime && (
                                      <p className={`text-[9px] mt-0.5 ${col.sub}`}>
                                        🕐 {ev.startTime}{ev.endTime && ev.endTime !== ev.startTime ? ` – ${ev.endTime}` : ""}
                                      </p>
                                    )}
                                    {ev.location && (
                                      <p className={`text-[9px] ${col.sub}`}>
                                        📍 {ev.location}
                                      </p>
                                    )}
                                    {canEdit && (
                                      <p className={`text-[8px] mt-0.5 opacity-50 ${col.title}`}>toque para editar</p>
                                    )}
                                    {(ev as any).endDate && (ev as any).endDate !== ev.date && (() => {
                                      const totalDays = Math.round((new Date((ev as any).endDate).getTime() - new Date(ev.date).getTime()) / 86400000) + 1;
                                      const dayIdx = Math.round((new Date(dateStr).getTime() - new Date(ev.date).getTime()) / 86400000) + 1;
                                      return (
                                        <div className="flex justify-end mt-0.5">
                                          <span className={`text-[9px] font-bold px-1 rounded ${isDark ? "bg-slate-600 text-slate-200" : "bg-slate-200 text-slate-600"}`}>{dayIdx}/{totalDays}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Bottom navigation (duplicata do topo) ───────────────────────────── */}
      <div className={`flex items-center justify-end gap-2 p-3 rounded-xl border ${card}`}>
        <button onClick={() => setCurrentDate(addDays(currentDate, -7))}
          className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
          <ChevronLeft size={16} className={muted} />
        </button>
        <div className="relative">
          <button
            onClick={() => {
              setPickerMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
              setIsDatePickerOpen((v) => !v);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}>
            Calendário
          </button>
          {isDatePickerOpen && (
              <div ref={datePickerRef} className={`date-picker-popup absolute right-0 bottom-full mb-1 z-50 rounded-xl border shadow-xl p-3 w-64 ${isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}
                    className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}>
                    <ChevronLeft size={14} />
                  </button>
                  <span className={`text-xs font-semibold ${text}`}>
                    {pickerMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </span>
                  <button onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}
                    className={`p-1 rounded hover:bg-slate-500/20 ${muted}`}>
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {["D","S","T","Q","Q","S","S"].map((d, i) => (
                    <div key={i} className={`text-center text-[10px] font-bold ${muted}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {(() => {
                    const year = pickerMonth.getFullYear();
                    const month = pickerMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const todayStr = formatDate(new Date());
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cells: any[] = [];
                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= daysInMonth; d++) {
                      const date = new Date(year, month, d);
                      const dateStr = formatDate(date);
                      const isT = dateStr === todayStr;
                      const isSel = formatDate(getStartOfWeek(currentDate)) === formatDate(getStartOfWeek(date));
                      cells.push(
                        <button key={d}
                          onClick={() => { setCurrentDate(date); setIsDatePickerOpen(false); }}
                          className={`text-[11px] h-7 w-full rounded transition-colors font-medium
                            ${isT ? "bg-blue-500 text-white" : isSel ? (isDark ? "bg-slate-600 text-slate-100" : "bg-slate-200 text-slate-800") : `hover:bg-blue-500/15 ${text}`}`}>
                          {d}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
                <button
                  onClick={() => { setCurrentDate(new Date()); setIsDatePickerOpen(false); }}
                  className="mt-2 w-full text-[11px] py-1 rounded-lg border border-blue-400/50 text-blue-500 hover:bg-blue-500/10 transition-colors font-medium">
                  Ir para hoje
                </button>
              </div>
          )}
        </div>
        <button onClick={() => setCurrentDate(addDays(currentDate, 7))}
          className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
          <ChevronRight size={16} className={muted} />
        </button>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      {disciplines.length > 0 && (() => {
        const visibleDates = new Set(weekDays.slice(0, 6).map((d) => d.toISOString().slice(0, 10)));
        const usedIds = new Set(
          weekEvents
            .filter((e) =>
              visibleDates.has(e.date) &&
              e.classId?.startsWith(String(currentSquadron)) &&
              e.type !== "ACADEMIC" &&
              e.disciplineId !== "ACADEMIC"
            )
            .map((e) => e.disciplineId)
        );
        const usedDiscs = disciplines
          .filter((d) => usedIds.has(d.id))
          .sort((a, b) => a.code.localeCompare(b.code));
        if (!usedDiscs.length) return null;
        return (
          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
            <div className="flex flex-col gap-1">
              {usedDiscs.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className={`text-[10px] ${muted}`}>{d.code} — {d.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Alocação em Lote */}
      {isBatchFormOpen && selectedSlots.length > 0 && (
        <EventForm
          initialData={{
            classId: selectedSlots[0].classId,
            date: selectedSlots[0].date,
            startTime: TIME_SLOTS[selectedSlots[0].slotIndex]?.start || "07:00",
            endTime: TIME_SLOTS[selectedSlots[0].slotIndex]?.end || "08:00",
            type: "CLASS",
          }}
          lockClass
          isBatchMode
          onSubmit={handleBatchAllocate}
          onCancel={() => { setIsBatchFormOpen(false); setBatchAllSquadronsMode(false); }}
          extraHeader={
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={batchAllSquadronsMode}
                onChange={(e) => setBatchAllSquadronsMode(e.target.checked)}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Replicar para todos os esquadrões (1º ao 4º)
              </span>
            </label>
          }
        />
      )}

      {/* Dialog de conflito — alocação em lote */}
      {isBatchConflictDialogOpen && pendingBatchEvents.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className={`rounded-xl border shadow-2xl p-5 w-full max-w-md mx-4 ${card}`}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-semibold ${text}`}>Conflito de aulas</p>
                <p className={`text-xs mt-1 ${muted}`}>
                  Os seguintes slots já têm aula alocada:
                </p>
                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {batchConflictEvents.map((e) => {
                    const disc = useCourseStore.getState().disciplines.find((d) => d.id === e.disciplineId);
                    return (
                      <li key={e.id} className={`text-xs px-2 py-1 rounded-lg border ${isDark ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200"} ${text}`}>
                        <span className="font-semibold">{e.classId}</span> — {disc?.code ?? e.disciplineId} · {e.date} {e.startTime}
                      </li>
                    );
                  })}
                </ul>
                <p className={`text-xs mt-3 ${muted}`}>Deseja sobrescrever as aulas em conflito?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsBatchConflictDialogOpen(false); doSaveBatchEvents(pendingBatchEvents, false); }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}>
                Ignorar conflitos
              </button>
              <button
                onClick={() => { setIsBatchConflictDialogOpen(false); doSaveBatchEvents(pendingBatchEvents, true); }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-amber-500 border-amber-500 text-white hover:bg-amber-600">
                Sobrescrever
              </button>
              <button
                onClick={() => { setIsBatchConflictDialogOpen(false); setPendingBatchEvents([]); setBatchConflictEvents([]); }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-red-500/10 border-red-400/50 text-red-500 hover:bg-red-500/20">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edição de aula */}
      {isModalOpen && editingEvent && (
        <EventForm
          initialData={editingEvent}
          lockClass={!editingEvent.id}
          onSubmit={handleEventSubmit}
          onDelete={(id) => {
            useCourseStore.getState().deleteEvent(id);
            setWeekEvents((prev) => prev.filter((e) => e.id !== id));
            setIsModalOpen(false);
            setEditingEvent(undefined);
            setAllSquadronsMode(false);
          }}
          onCancel={() => { setIsModalOpen(false); setEditingEvent(undefined); setAllSquadronsMode(false); }}
          extraHeader={
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSquadronsMode}
                onChange={(e) => setAllSquadronsMode(e.target.checked)}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Replicar para todos os esquadrões (1º ao 4º)
              </span>
            </label>
          }
        />
      )}

      {/* Dialog de conflito ao replicar para todos os esquadrões */}
      {isConflictDialogOpen && pendingSubmitData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className={`rounded-xl border shadow-2xl p-5 w-full max-w-md mx-4 ${card}`}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-semibold ${text}`}>Conflito de aulas</p>
                <p className={`text-xs mt-1 ${muted}`}>
                  Os seguintes esquadrões já têm uma aula alocada neste horário:
                </p>
                <ul className="mt-2 space-y-1">
                  {conflictEvents.map((e) => {
                    const disc = useCourseStore.getState().disciplines.find((d) => d.id === e.disciplineId);
                    return (
                      <li key={e.id} className={`text-xs px-2 py-1 rounded-lg border ${isDark ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200"} ${text}`}>
                        <span className="font-semibold">{e.classId}</span> — {disc?.code ?? e.disciplineId} ({e.startTime})
                      </li>
                    );
                  })}
                </ul>
                <p className={`text-xs mt-3 ${muted}`}>Deseja sobrescrever as aulas em conflito?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsConflictDialogOpen(false); doSaveEvent(pendingSubmitData, false); }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}>
                Ignorar conflitos
              </button>
              <button
                onClick={() => { setIsConflictDialogOpen(false); doSaveEvent(pendingSubmitData, true); }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-amber-500 border-amber-500 text-white hover:bg-amber-600">
                Sobrescrever
              </button>
              <button
                onClick={() => { setIsConflictDialogOpen(false); setPendingSubmitData(null); setConflictEvents([]); }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-red-500/10 border-red-400/50 text-red-500 hover:bg-red-500/20">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Criação de aviso */}
      {noticeFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setNoticeFormDate(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <NoticeForm
              initialData={{
                startDate: noticeFormDate,
                endDate: noticeFormDate,
                targetSquadron: currentSquadron,
                targetRoles: ["CADETE", "DOCENTE", "ADMIN", "SUPER_ADMIN"] as any,
              }}
              onSubmit={handleNoticeSubmit}
              onCancel={() => setNoticeFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Edição de aviso */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditingNotice(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <NoticeForm
              initialData={editingNotice}
              onSubmit={handleNoticeUpdate}
              onDelete={handleNoticeDelete}
              onCancel={() => setEditingNotice(null)}
            />
          </div>
        </div>
      )}

      {/* Criação de evento acadêmico */}
      {academicFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAcademicFormDate(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4">
            <AcademicEventForm
              initialData={{
                date: academicFormDate,
                type: "ACADEMIC" as any,
                disciplineId: "ACADEMIC",
                classId: `${currentSquadron}ESQ`,
                targetSquadron: currentSquadron,
                startTime: "",   // vazio = dia inteiro por padrão
                endTime: "",
              }}
              onSubmit={handleAcademicSubmit}
              onCancel={() => setAcademicFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Edição de evento acadêmico */}
      {editingAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditingAcademic(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4">
            <AcademicEventForm
              initialData={editingAcademic}
              onSubmit={handleAcademicUpdate}
              onDelete={handleAcademicDelete}
              onCancel={() => setEditingAcademic(null)}
            />
          </div>
        </div>
      )}

      {/* SAP Link */}
      {isLinkModalOpen && (
        <LinkChangeRequestModal
          selectedEventIds={selectedEventIds}
          onClose={() => setIsLinkModalOpen(false)}
          onLinked={(requestId) => {
            // Atualiza weekEvents imediatamente para exibir a tag SAP sem reload
            setWeekEvents((prev) =>
              prev.map((e) =>
                selectedEventIds.includes(e.id)
                  ? { ...e, changeRequestId: requestId }
                  : e
              )
            );
            setIsLinkModalOpen(false);
            setIsSelectionMode(false);
            setSelectedEventIds([]);
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Excluir aulas selecionadas"
        message={`Deseja excluir ${selectedEventIds.length} aula(s) selecionada(s)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleBatchDelete}
        type="danger"
      />
      </div>{/* end content */}
    </div>
  );
};
