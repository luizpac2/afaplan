import { useState, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { TIME_SLOTS } from "../utils/constants";

// ── helpers ──────────────────────────────────────────────────────────────────

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function getWeekDates(base: Date): Date[] {
  const monday = new Date(base);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function LocaisGrid() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { locations, locationReservations, events, classes, disciplines, addLocationReservation, deleteLocationReservation } = useCourseStore();

  const [weekBase, setWeekBase] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");
  const [addingSlot, setAddingSlot] = useState<{ locationId: string; date: string; slotIdx: number } | null>(null);
  const [slotForm, setSlotForm] = useState<{ classId: string; label: string }>({ classId: "", label: "" });
  const [isSaving, setIsSaving] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);
  const weekStart = toISO(weekDates[0]);
  const weekEnd   = toISO(weekDates[6]);

  const activeLocations = useMemo(() => locations.filter((l) => l.status === "ATIVO"), [locations]);
  const displayLocations = useMemo(
    () => selectedLocationId === "ALL" ? activeLocations : activeLocations.filter((l) => l.id === selectedLocationId),
    [activeLocations, selectedLocationId],
  );

  // Reservas da semana
  const weekReservations = useMemo(
    () => locationReservations.filter((r) => r.date >= weekStart && r.date <= weekEnd),
    [locationReservations, weekStart, weekEnd],
  );

  // Eventos programados da semana com local preenchido
  const weekEvents = useMemo(
    () => events.filter((e) => e.date >= weekStart && e.date <= weekEnd && !!e.location?.trim()),
    [events, weekStart, weekEnd],
  );

  // Helpers
  function getDisciplineName(disciplineId?: string) {
    if (!disciplineId) return null;
    const d = disciplines.find((x) => x.id === disciplineId || x.code === disciplineId);
    return d?.name ?? d?.code ?? null;
  }
  function getClassName(classId?: string) {
    if (!classId) return null;
    const c = classes.find((x) => x.id === classId);
    return c ? `${c.year}º ${c.name}` : classId;
  }

  // Capacidade: para cada local+slot, quantidade de alunos da turma alocada
  function getStudentCount(classId: string) {
    const cls = classes.find((c) => c.id === classId || `${c.year}${c.name}` === classId);
    return cls?.studentCount ?? null;
  }

  function navWeek(delta: number) {
    setWeekBase((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta * 7);
      return n;
    });
  }

  const text  = isDark ? "text-slate-100" : "text-slate-900";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const card  = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const input = isDark
    ? "bg-slate-700 border-slate-600 text-slate-100"
    : "bg-white border-slate-300 text-slate-900";
  const headerBg = isDark ? "bg-slate-900" : "bg-slate-50";
  const rowBg    = isDark ? "bg-slate-800/60" : "bg-white";
  const borderC  = isDark ? "border-slate-700" : "border-slate-200";

  const handleAddReservation = async () => {
    if (!addingSlot) return;
    if (!slotForm.classId && !slotForm.label.trim()) {
      alert("Informe a turma ou uma descrição.");
      return;
    }
    setIsSaving(true);
    try {
      const slot = TIME_SLOTS[addingSlot.slotIdx];
      await addLocationReservation({
        locationId: addingSlot.locationId,
        date:       addingSlot.date,
        startTime:  slot.start,
        endTime:    slot.end,
        classId:    slotForm.classId || undefined,
        label:      slotForm.label || undefined,
      });
      setAddingSlot(null);
      setSlotForm({ classId: "", label: "" });
    } catch (e: any) {
      alert("Erro ao reservar: " + (e?.message ?? ""));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`min-h-screen p-4 md:p-6 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Grade Semanal de Locais</h1>
          <p className={`text-sm ${muted}`}>
            {formatDate(weekDates[0])} – {formatDate(weekDates[6])} ·{" "}
            {weekDates[0].getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className={`px-3 py-2 text-sm rounded-lg border ${input}`}
          >
            <option value="ALL">Todos os locais</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button onClick={() => navWeek(-1)} className={`px-3 py-2 rounded-lg border text-sm font-semibold ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-100"} transition-colors`}>‹</button>
          <button onClick={() => { setWeekBase(new Date()); }} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-100"} transition-colors`}>Hoje</button>
          <button onClick={() => navWeek(1)} className={`px-3 py-2 rounded-lg border text-sm font-semibold ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-100"} transition-colors`}>›</button>
        </div>
      </div>

      {displayLocations.length === 0 && (
        <div className={`flex items-center justify-center rounded-xl border min-h-40 ${card}`}>
          <p className={`text-sm ${muted}`}>Nenhum local ativo cadastrado.</p>
        </div>
      )}

      {/* ── Grids por local ───────────────────────────────────────────────── */}
      {displayLocations.map((loc) => {
        const locReservations = weekReservations.filter((r) => r.locationId === loc.id);

        return (
          <div key={loc.id} className={`mb-6 rounded-xl border overflow-hidden ${card}`}>
            {/* Local header */}
            <div className={`px-4 py-2 flex items-center justify-between border-b ${borderC} ${isDark ? "bg-slate-700/50" : "bg-slate-50"}`}>
              <div>
                <span className={`font-bold text-sm ${text}`}>{loc.name}</span>
                <span className={`ml-2 text-xs ${muted}`}>{loc.capacity} lugares</span>
              </div>
              {loc.equipment.length > 0 && (
                <span className={`text-[10px] ${muted} hidden md:block`}>{loc.equipment.join(" · ")}</span>
              )}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: 640 }}>
                <thead>
                  <tr className={headerBg}>
                    <th className={`w-20 px-2 py-2 text-left font-semibold border-r border-b ${borderC} ${muted}`}>Horário</th>
                    {weekDates.map((d, di) => {
                      const isToday = toISO(d) === toISO(new Date());
                      return (
                        <th key={di} className={`px-1 py-2 text-center font-semibold border-r border-b ${borderC} ${isToday ? "text-blue-400" : muted}`}>
                          <div>{DAYS[d.getDay()]}</div>
                          <div className={`text-[10px] font-normal ${isToday ? "text-blue-400" : muted}`}>{formatDate(d)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot, si) => (
                    <tr key={si} className={`${rowBg} border-b ${borderC} last:border-b-0`}>
                      <td className={`px-2 py-1 border-r ${borderC} font-mono text-[10px] ${muted} whitespace-nowrap`}>
                        {slot.start}<br />{slot.end}
                      </td>
                      {weekDates.map((d, di) => {
                        const dateStr = toISO(d);
                        // Reserva manual para este slot
                        const res = locReservations.find(
                          (r) => r.date === dateStr && r.startTime === slot.start
                        );
                        // Eventos do Gantt que usam este local neste slot (comparação case-insensitive)
                        const locNameLower = loc.name.trim().toLowerCase();
                        const ganttEvents = weekEvents.filter(
                          (e) =>
                            e.date === dateStr &&
                            e.startTime === slot.start &&
                            e.location!.trim().toLowerCase() === locNameLower
                        );

                        const studentCount = res?.classId ? getStudentCount(res.classId) : null;
                        const overCapacity = studentCount != null && studentCount > loc.capacity;

                        // Reserva manual — prioridade
                        if (res) {
                          return (
                            <td key={di} className={`px-1 py-0.5 border-r ${borderC} relative`}>
                              <div
                                className={`rounded px-1 py-0.5 flex items-start justify-between gap-0.5 ${
                                  overCapacity
                                    ? "bg-red-600/20 border border-red-600"
                                    : "bg-blue-600/20 border border-blue-600/40"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className={`font-bold truncate text-[10px] ${overCapacity ? "text-red-400" : "text-blue-400"}`}>
                                    {res.classId ? getClassName(res.classId) : (res.label || "Reservado")}
                                  </p>
                                  {overCapacity && studentCount != null && (
                                    <p className="text-[9px] text-red-400">⚠ {studentCount}/{loc.capacity}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => deleteLocationReservation(res.id)}
                                  className="text-[9px] text-slate-400 hover:text-red-400 flex-shrink-0 leading-none"
                                  title="Remover reserva"
                                >✕</button>
                              </div>
                            </td>
                          );
                        }

                        // Eventos do Gantt neste local/slot
                        if (ganttEvents.length > 0) {
                          return (
                            <td key={di} className={`px-1 py-0.5 border-r ${borderC}`}>
                              <div className="flex flex-col gap-0.5">
                                {ganttEvents.map((ev) => {
                                  const discName = getDisciplineName(ev.disciplineId);
                                  const clsName  = getClassName(ev.classId);
                                  return (
                                    <div key={ev.id} className="rounded px-1 py-0.5 bg-emerald-600/15 border border-emerald-600/40">
                                      {discName && (
                                        <p className="font-bold truncate text-[10px] text-emerald-400">{discName}</p>
                                      )}
                                      <p className={`truncate text-[9px] ${muted}`}>{clsName}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        }

                        // Vazio — clique para reservar
                        return (
                          <td
                            key={di}
                            className={`px-1 py-0.5 border-r ${borderC} hover:bg-blue-500/10 cursor-pointer transition-colors`}
                            onClick={() => {
                              setAddingSlot({ locationId: loc.id, date: dateStr, slotIdx: si });
                              setSlotForm({ classId: "", label: "" });
                            }}
                            title="Clique para reservar"
                          >
                            <div className="h-7" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ── Modal: nova reserva ───────────────────────────────────────────── */}
      {addingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAddingSlot(null)}>
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${card}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`font-bold text-base mb-3 ${text}`}>Reservar Horário</h3>
            <p className={`text-xs mb-3 ${muted}`}>
              {locations.find((l) => l.id === addingSlot.locationId)?.name} ·{" "}
              {DAYS_FULL[new Date(addingSlot.date + "T12:00:00").getDay()]} {addingSlot.date} ·{" "}
              {TIME_SLOTS[addingSlot.slotIdx].label}
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className={`text-xs font-semibold ${muted}`}>Turma (opcional)</label>
                <select
                  value={slotForm.classId}
                  onChange={(e) => setSlotForm((p) => ({ ...p, classId: e.target.value }))}
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                >
                  <option value="">— Nenhuma turma —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.year}º Ano · {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`text-xs font-semibold ${muted}`}>Ou descrição livre</label>
                <input
                  type="text"
                  value={slotForm.label}
                  onChange={(e) => setSlotForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Ex: Reunião, Evento especial..."
                  className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${input}`}
                />
              </div>
            </div>

            {/* Alerta de capacidade */}
            {slotForm.classId && (() => {
              const count = getStudentCount(slotForm.classId);
              const loc = locations.find((l) => l.id === addingSlot.locationId);
              if (count != null && loc && count > loc.capacity) {
                return (
                  <div className="mt-3 p-2 rounded-lg bg-red-600/10 border border-red-600/40">
                    <p className="text-xs text-red-400 font-semibold">
                      ⚠ Capacidade excedida: {count} alunos / {loc.capacity} lugares
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddingSlot(null)} className={`px-3 py-1.5 text-sm rounded-lg border ${isDark ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}>
                Cancelar
              </button>
              <button
                onClick={handleAddReservation}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Reservar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
