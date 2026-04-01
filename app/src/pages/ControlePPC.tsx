import { useState, useMemo, useEffect } from "react";
import { useCourseStore } from "../store/useCourseStore";
import { useTheme } from "../contexts/ThemeContext";
import { BarChart3, Filter, CheckCircle } from "lucide-react";
import { Badge } from "../components/common/Badge";
import type { ScheduleEvent, CourseYear, Discipline } from "../types";

export const ControlePPC = () => {
  const { disciplines, classes, fetchYearlyEvents } = useCourseStore();
  const { theme } = useTheme();

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [calendarYear, setCalendarYear] = useState<number>(
    new Date().getFullYear(),
  );

  // Window Query state
  const [yearEvents, setYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    fetchYearlyEvents(calendarYear).then((data) => {
      setYearEvents(data);
    });
  }, [calendarYear, fetchYearlyEvents]);
  // Courses: AVIATION (A-D), INTENDANCY (E), INFANTRY (F)
  // We can filter columns by course type if needed, or just show all classes for the year.
  const [selectedCourseType, setSelectedCourseType] = useState<
    "ALL" | "AVIATION" | "INTENDANCY" | "INFANTRY"
  >("ALL");

  // Constants
  const SQUADRONS = [
    { id: 1, name: "1º Esquadrão" },
    { id: 2, name: "2º Esquadrão" },
    { id: 3, name: "3º Esquadrão" },
    { id: 4, name: "4º Esquadrão" },
  ];

  // Filtered Data
  const filteredDisciplines = useMemo(() => {
    let filtered = disciplines.filter(
      (d) =>
        d.enabledYears?.includes(selectedYear as CourseYear) ||
        (!d.enabledYears?.length &&
          (d.year === selectedYear || d.year === "ALL")),
    );

    // If specific course type selected, also filter by course
    if (selectedCourseType !== "ALL") {
      filtered = filtered.filter(
        (d) =>
          d.enabledCourses?.includes(selectedCourseType) ||
          (!d.enabledCourses?.length &&
            (d.course === selectedCourseType || d.course === "ALL")),
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [disciplines, selectedYear, selectedCourseType]);

  const yearClasses = useMemo(() => {
    return (
      classes
        .filter((c) => c.year === selectedYear)
        .filter(
          (c) => selectedCourseType === "ALL" || c.type === selectedCourseType,
        )
        // Sort by name (A, B, C...)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [classes, selectedYear, selectedCourseType]);

  // Calculations
  const getPlannedLoad = (disciplineId: string, classId: string) => {
    // Count events for this discipline and class
    // Assuming 1 Event = 1 Tempo (Unit of load)
    const count = yearEvents.filter(
      (e) => e.disciplineId === disciplineId && e.classId === classId,
    ).length;

    return count;
  };

  const getTargetLoad = (
    d: Discipline,
    courseType: string,
    year: number,
  ): number => {
    const key = `${courseType}_${year}`;
    if (d.ppcLoads && typeof d.ppcLoads[key] === "number") {
      return d.ppcLoads[key];
    }
    return d.load_hours || 0;
  };

  return (
    <div className="p-3 md:p-4 md:h-full flex flex-col max-w-full mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1
            className={`text-xl  tracking-tight flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            <BarChart3 className="text-blue-600" size={24} />
            Controle do PPC
          </h1>
          <p
            className={`text-xs mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            Comparativo de Carga Horária: Previsto (PPC) vs. Planejado (Grade)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`p-3 rounded-lg shadow-sm border mb-3 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        <div className="flex gap-3 items-center flex-wrap">
          <div
            className={`flex items-center gap-1.5  text-xs ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
          >
            <Filter size={16} />
            Filtros:
          </div>

          <div className="flex flex-col">
            <select
              value={calendarYear}
              onChange={(e) => setCalendarYear(Number(e.target.value))}
              className={`px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500/20  ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-slate-50 border-slate-300"}`}
            >
              {Array.from(
                { length: 6 },
                (_, i) => new Date().getFullYear() - 2 + i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500/20  ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-blue-50 border-blue-300"}`}
            >
              {SQUADRONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <select
              value={selectedCourseType}
              onChange={(e) =>
                setSelectedCourseType(
                  e.target.value as
                    | "ALL"
                    | "AVIATION"
                    | "INTENDANCY"
                    | "INFANTRY",
                )
              }
              className={`px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500/20 ${theme === "dark" ? "text-slate-200" : ""} ${
                selectedCourseType === "ALL"
                  ? theme === "dark"
                    ? "border-slate-600 bg-slate-700"
                    : "border-slate-200 bg-white"
                  : theme === "dark"
                    ? "border-slate-600 bg-slate-700 "
                    : "border-blue-300 bg-blue-50 "
              }`}
            >
              <option value="ALL">Todos os Cursos</option>
              <option value="AVIATION">✈️ Aviação</option>
              <option value="INTENDANCY">📊 Intendência</option>
              <option value="INFANTRY">🎖️ Infantaria</option>
            </select>
          </div>

          <div className="ml-auto flex gap-2 text-[10px]">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-400 mb-0.5">Exibindo</span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 ">
                📚 {filteredDisciplines.length}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-400 mb-0.5">&nbsp;</span>
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200 ">
                👥 {yearClasses.length}
              </span>
            </div>
          </div>
        </div>

        {/* Maintenance Actions */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={() => {
              const store = useCourseStore.getState();

              // 1. Detect exact name duplicates
              const nameMap = new Map<string, string[]>(); // Name -> IDs[]
              store.disciplines.forEach((d) => {
                const ids = nameMap.get(d.name) || [];
                ids.push(d.id);
                nameMap.set(d.name, ids);
              });

              const duplicates = Array.from(nameMap.entries())
                .filter(([, ids]) => ids.length > 1)
                .map(([name, ids]) => ({ name, ids }));

              // 2. Detect deprecated codes
              const deprecatedCodes = [
                "CONT",
                "ESP1",
                "ESP2",
                "ESP3",
                "ESP4",
                "ING1",
                "ING2",
                "ING3",
                "ING4",
                "MECI",
                "POT1",
                "POT2",
              ];
              const deprecated = store.disciplines.filter(
                (d) =>
                  deprecatedCodes.includes(d.code) ||
                  (d.code === "ADCE" &&
                    d.name === "À Disposição do Comandante do ESQ"),
              );

              let message = "";
              const toRemoveIds = new Set<string>();

              if (duplicates.length > 0) {
                message += `Found ${duplicates.length} duplicate names:\n`;
                duplicates.forEach((d) => {
                  message += `- ${d.name} (${d.ids.length} copies)\n`;
                  // Keep the first one, remove others
                  d.ids.slice(1).forEach((id) => toRemoveIds.add(id));
                });
                message += "\n";
              }

              if (deprecated.length > 0) {
                message += `Found ${deprecated.length} deprecated disciplines:\n`;
                deprecated.forEach((d) => {
                  message += `- ${d.name} (${d.code})\n`;
                  toRemoveIds.add(d.id);
                });
              }

              if (toRemoveIds.size > 0) {
                if (confirm(`${message}\nRemove ${toRemoveIds.size} items?`)) {
                  toRemoveIds.forEach((id) => store.deleteDiscipline(id));
                  alert("Cleanup successful! Reloading...");
                  window.location.reload();
                }
              } else {
                alert(
                  `No duplicates or deprecated items found.\nTotal disciplines: ${store.disciplines.length}`,
                );
                // Debug names to console
                console.log(
                  "All disciplines:",
                  store.disciplines.map((d) => `${d.name} (${d.code})`).sort(),
                );
              }
            }}
            className="text-[10px] text-red-600 hover:text-red-800 underline flex items-center gap-1"
          >
            🛠️ Corrigir Duplicatas
          </button>
        </div>

        {/* Active Filter Indicator */}
        {selectedCourseType !== "ALL" && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-500">🎯 Filtro:</span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded ">
                {selectedCourseType === "AVIATION" && "Aviação"}
                {selectedCourseType === "INTENDANCY" && "Intendência"}
                {selectedCourseType === "INFANTRY" && "Infantaria"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Matrix Table */}
      <div
        className={`flex-1 rounded-lg shadow-sm border md:overflow-hidden flex flex-col ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead
              className={` border-b sticky top-0 z-10 ${theme === "dark" ? "bg-slate-700/50 text-slate-300 border-slate-700" : "bg-slate-50 text-slate-600 border-slate-200"}`}
            >
              <tr>
                <th
                  className={`px-3 py-2 min-w-[250px] border-r ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
                >
                  Disciplina
                </th>
                <th
                  className={`px-2 py-2 text-center border-r w-20 ${theme === "dark" ? "border-slate-700 bg-blue-900/20 text-blue-300" : "border-slate-200 bg-blue-50 text-blue-800"}`}
                >
                  PPC
                </th>
                {yearClasses.map((c) => (
                  <th
                    key={c.id}
                    className={`px-2 py-2 text-center min-w-[60px] border-r ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}
                  >
                    {c.name}
                    <div className="text-[9px] font-normal text-slate-400">
                      {c.type === "AVIATION"
                        ? "Av"
                        : c.type === "INTENDANCY"
                          ? "Int"
                          : "Inf"}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center min-w-[80px]">Status</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
            >
              {filteredDisciplines.map((d) => {
                // Calculate display load for the "PPC" column
                let displayPpcLoad: React.ReactNode = "-";
                let maxPpcLoad = 0;

                if (selectedCourseType !== "ALL") {
                  const load = getTargetLoad(
                    d,
                    selectedCourseType,
                    selectedYear,
                  );
                  displayPpcLoad = load;
                  maxPpcLoad = load;
                } else {
                  // Make a set of unique loads for the classes present
                  const loads = new Map<number, string[]>();
                  yearClasses.forEach((c) => {
                    const load = getTargetLoad(d, c.type, selectedYear);
                    if (load > 0) {
                      const courses = loads.get(load) || [];
                      if (!courses.includes(c.type)) {
                        courses.push(c.type);
                      }
                      loads.set(load, courses);
                    }
                  });

                  maxPpcLoad = Array.from(loads.keys()).reduce(
                    (a, b) => Math.max(a, b),
                    0,
                  );

                  if (loads.size === 0) {
                    // Try fallback to legacy
                    displayPpcLoad = d.load_hours || 0;
                    maxPpcLoad = d.load_hours || 0;
                  } else if (loads.size === 1) {
                    displayPpcLoad = Array.from(loads.keys())[0];
                  } else {
                    // Differing loads
                    displayPpcLoad = (
                      <div className="flex flex-col gap-0.5 text-[9px] sm:text-[10px]">
                        {Array.from(loads.entries()).map(([l, courses]) => (
                          <span key={l}>
                            {courses
                              .map((c) =>
                                c === "AVIATION"
                                  ? "Av"
                                  : c === "INTENDANCY"
                                    ? "Int"
                                    : "Inf",
                              )
                              .join(", ")}
                            : {l}
                          </span>
                        ))}
                      </div>
                    );
                  }
                }

                return (
                  <tr
                    key={d.id}
                    className={`hover:bg-slate-50 ${theme === "dark" ? "hover:bg-slate-800" : ""}`}
                  >
                    <td
                      className={`px-3 py-1.5  border-r ${theme === "dark" ? "text-slate-300 border-slate-700" : "text-slate-700 border-slate-200"}`}
                    >
                      {d.name}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {d.code}
                      </div>
                    </td>
                    <td
                      className={`px-2 py-1.5 text-center  border-r ${theme === "dark" ? "text-slate-200 border-slate-700 bg-blue-900/10" : "text-slate-800 border-slate-200 bg-blue-50/30"}`}
                    >
                      {displayPpcLoad}
                    </td>
                    {yearClasses.map((c) => {
                      const classPpcLoad = getTargetLoad(
                        d,
                        c.type,
                        selectedYear,
                      );
                      const planned = getPlannedLoad(d.id, c.id);

                      // Only render styling/checking if classPpcLoad > 0 implies it is valid for this class.
                      // If classPpcLoad is 0 but it has planned, it's an excess.
                      const isMatch = planned === classPpcLoad;
                      const isOver = planned > classPpcLoad;
                      const isUnder = planned < classPpcLoad;

                      // Color coding
                      let textColor =
                        theme === "dark" ? "text-slate-400" : "text-slate-500";
                      if (classPpcLoad > 0 || planned > 0) {
                        if (isMatch)
                          textColor =
                            theme === "dark"
                              ? "text-green-400 "
                              : "text-green-600 ";
                        if (isOver)
                          textColor =
                            theme === "dark"
                              ? "text-orange-400 "
                              : "text-orange-600 ";
                        if (isUnder && planned > 0)
                          textColor =
                            theme === "dark"
                              ? "text-red-400 "
                              : "text-red-500 ";
                        if (isUnder && planned === 0)
                          textColor =
                            theme === "dark"
                              ? "text-slate-500"
                              : "text-slate-400";
                      }

                      return (
                        <td
                          key={c.id}
                          className={`px-2 py-1.5 text-center border-r ${theme === "dark" ? "border-slate-700" : "border-slate-100"} ${textColor}`}
                        >
                          {classPpcLoad > 0 || planned > 0 ? planned : "-"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center">
                      {maxPpcLoad > 0 ||
                      yearClasses.some(
                        (c) => getPlannedLoad(d.id, c.id) > 0,
                      ) ? (
                        (() => {
                          // Check if any class significantly differs
                          const hasExcess = yearClasses.some(
                            (c) =>
                              getPlannedLoad(d.id, c.id) >
                              getTargetLoad(d, c.type, selectedYear),
                          );
                          const hasDeficit = yearClasses.some((c) => {
                            const tgt = getTargetLoad(d, c.type, selectedYear);
                            return tgt > 0 && getPlannedLoad(d.id, c.id) < tgt;
                          });
                          const allMatch = yearClasses.every((c) => {
                            const tgt = getTargetLoad(d, c.type, selectedYear);
                            return getPlannedLoad(d.id, c.id) === tgt;
                          });

                          if (allMatch) {
                            return (
                              <Badge
                                variant="green"
                                className="inline-flex items-center gap-1"
                              >
                                <CheckCircle size={10} />
                                OK
                              </Badge>
                            );
                          } else if (hasExcess && hasDeficit) {
                            return (
                              <Badge
                                variant="orange"
                                className="inline-flex items-center gap-1"
                              >
                                ⚠️ Misto
                              </Badge>
                            );
                          } else if (hasExcess) {
                            return (
                              <Badge
                                variant="orange"
                                className="inline-flex items-center gap-1"
                              >
                                ⬆️ Excesso
                              </Badge>
                            );
                          } else if (hasDeficit) {
                            return (
                              <Badge
                                variant="red"
                                className="inline-flex items-center gap-1"
                              >
                                ⬇️ Déficit
                              </Badge>
                            );
                          } else {
                            return (
                              <Badge
                                variant="slate"
                                className="inline-flex items-center gap-1"
                              >
                                —
                              </Badge>
                            );
                          }
                        })()
                      ) : (
                        <span
                          className={`text-[10px] ${theme === "dark" ? "text-slate-600" : "text-slate-300"}`}
                        >
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Status Legend */}
        <div
          className={`p-3 border-t ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
        >
          <div className="flex items-center gap-4 text-[10px]">
            <span
              className={` ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
            >
              Legenda:
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="green"
                className="inline-flex items-center gap-0.5"
              >
                <CheckCircle size={10} />
                OK
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="orange"
                className="inline-flex items-center gap-0.5"
              >
                ⬆️ Excesso
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="red" className="inline-flex items-center gap-0.5">
                ⬇️ Déficit
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
