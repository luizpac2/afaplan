import { useState, useMemo, useEffect } from "react";
import { useCourseStore } from "../store/useCourseStore";
import { useTheme } from "../contexts/ThemeContext";
import {
  BookOpen,
  Calendar as CalendarIcon,
  Users,
  Clock,
  Plane,
  Briefcase,
  Shield,
} from "lucide-react";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CourseYear, ScheduleEvent } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  colorClass,
  bgClass,
  theme,
}: any) => (
  <div
    className={`p-6 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border flex items-center transition-transform hover:-translate-y-1 duration-300 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
  >
    <div className={`p-3 rounded-lg ${bgClass} ${colorClass} mr-4`}>
      <Icon size={24} />
    </div>
    <div>
      <p
        className={`text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p
        className={`text-2xl  mt-0.5 ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
      >
        {value}
      </p>
      {subtext && (
        <p
          className={`text-xs mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
        >
          {subtext}
        </p>
      )}
    </div>
  </div>
);

export const GeneralOverview = () => {
  const { disciplines, cohorts } = useCourseStore();
  const { theme } = useTheme();
  const [selectedYear, setSelectedYear] = useState<CourseYear>(1);

  // Window Query state
  const [squadronEvents, setSquadronEvents] = useState<ScheduleEvent[]>([]);

  const { fetchYearlyEvents } = useCourseStore();

  useEffect(() => {
    // Usa o cache da store (TTL 5 mins) para evitar reads Firebase repetidos
    const currentYear = new Date().getFullYear();

    fetchYearlyEvents(currentYear).then((all) => {
      // Filtro local por esquadrão
      setSquadronEvents(
        all.filter((e) => {
          const isAcad = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";
          const belongsToSquadron =
            e.classId && e.classId.startsWith(String(selectedYear));
          return isAcad || belongsToSquadron;
        }),
      );
    });
  }, [selectedYear, fetchYearlyEvents]);

  // Get cohort name and color for the selected year
  const getCohortName = (year: CourseYear) => {
    const currentYear = new Date().getFullYear();
    const entryYear = currentYear - Number(year) + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return cohort?.name || null;
  };

  const getCohortColor = (year: CourseYear) => {
    const currentYear = new Date().getFullYear();
    const entryYear = currentYear - Number(year) + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return cohort?.color || "blue";
  };

  const currentCohortColor = getCohortColorTokens(getCohortColor(selectedYear), theme);

  // Helpers to identify Course Type based on class letter
  const getCourseType = (classLetter: string) => {
    const letter = classLetter.toUpperCase();
    if (letter === "A" || letter === "B" || letter === "C" || letter === "D") {
      return "CFOAv";
    }
    if (letter === "E") return "CFOInt";
    if (letter === "F") return "CFOInf";
    return "Outros";
  };

  const getCourseLabel = (type: string) => {
    switch (type) {
      case "CFOAv":
        return "Aviação";
      case "CFOInt":
        return "Intendência";
      case "CFOInf":
        return "Infantaria";
      default:
        return "Geral";
    }
  };

  const getCourseIcon = (type: string) => {
    switch (type) {
      case "CFOAv":
        return Plane;
      case "CFOInt":
        return Briefcase;
      case "CFOInf":
        return Shield;
      default:
        return Users;
    }
  };

  // Filter data by selected Year
  const yearDisciplines = disciplines.filter((d) => d.year === selectedYear);

  // Calculate Stats for the selected Year
  const stats = useMemo(() => {
    // Helper to calculate workload for a specific course type in a specific year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateCourseWorkload = (courseType: 'AVIATION' | 'INTENDANCY' | 'INFANTRY', year: number, disciplinesList: any[]) => {
      return disciplinesList.reduce((acc, disc) => {
        const key = `${courseType}_${year}`;
        if (disc.ppcLoads && typeof disc.ppcLoads[key] === 'number' && disc.ppcLoads[key] > 0) {
          return acc + disc.ppcLoads[key];
        }
        
        // Fallback
        if (disc.category === 'COMMON' || disc.category === courseType || (disc.enabledCourses && disc.enabledCourses.includes(courseType))) {
           if (disc.year === year || disc.year === 'ALL' || (disc.enabledYears && disc.enabledYears.includes(year as any))) {
               return acc + (disc.load_hours || 0);
           }
        }
        return acc;
      }, 0);
    };

    const loadCFOAv = calculateCourseWorkload('AVIATION', selectedYear, yearDisciplines);
    const loadCFOInt = calculateCourseWorkload('INTENDANCY', selectedYear, yearDisciplines);
    const loadCFOInf = calculateCourseWorkload('INFANTRY', selectedYear, yearDisciplines);

    const totalLoad = Math.max(loadCFOAv, loadCFOInt, loadCFOInf);

    const instructors = new Set(
      yearDisciplines.map((d) => d.instructor).filter(Boolean),
    ).size;

    const loadByCourse = {
      CFOAv: loadCFOAv,
      CFOInt: loadCFOInt,
      CFOInf: loadCFOInf,
    };

    // Events for this year's disciplines
    const yearEvents = squadronEvents.filter((e) => {
      const disc = disciplines.find((d) => d.id === e.disciplineId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return disc?.year === selectedYear || (disc?.enabledYears as any)?.includes(selectedYear as any);
    });

    return {
      disciplinesCount: yearDisciplines.length,
      totalLoad,
      loadByCourse,
      instructors,
      eventsCount: yearEvents.length,
      blockedDays: squadronEvents.filter(
        (e) =>
          (e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC") &&
          e.date.startsWith(String(new Date().getFullYear())),
      ).length,
    };
  }, [disciplines, squadronEvents, selectedYear, yearDisciplines]);

  // Get stats for ALL classes (A-F) in the selected squadron
  const classStats = useMemo(() => {
    const ALL_CLASSES_PER_SQUADRON = ["A", "B", "C", "D", "E", "F"];
    return ALL_CLASSES_PER_SQUADRON.map((classLetter) => {
      const classId = `${selectedYear}${classLetter}`;

      const classEvents = squadronEvents.filter((e) => {
        const disc = disciplines.find((d) => d.id === e.disciplineId);
        return disc?.year === selectedYear && e.classId === classId;
      });

      const courseType = getCourseType(classLetter);
      const uniqueDisciplines = new Set(classEvents.map((e) => e.disciplineId))
        .size;

      // Calculate Workload for this specific class
      const classWorkload = yearDisciplines.reduce((acc, disc) => {
        const typeMap = { CFOAv: 'AVIATION', CFOInt: 'INTENDANCY', CFOInf: 'INFANTRY' };
        const mappedType = typeMap[courseType as keyof typeof typeMap] as 'AVIATION' | 'INTENDANCY' | 'INFANTRY';
        
        if (mappedType) {
            const key = `${mappedType}_${selectedYear}`;
            if (disc.ppcLoads && typeof disc.ppcLoads[key] === 'number' && disc.ppcLoads[key] > 0) {
              return acc + disc.ppcLoads[key];
            }
        }
        
        if (disc.category === 'COMMON') return acc + (disc.load_hours || 0);
        if (courseType === 'CFOAv' && disc.category === 'AVIATION')
          return acc + (disc.load_hours || 0);
        if (courseType === 'CFOInt' && disc.category === 'INTENDANCY')
          return acc + (disc.load_hours || 0);
        if (courseType === 'CFOInf' && disc.category === 'INFANTRY')
          return acc + (disc.load_hours || 0);
        return acc;
      }, 0);

      return {
        classId,
        classLetter,
        courseType,
        eventsCount: classEvents.length,
        disciplinesCount: uniqueDisciplines,
        workload: classWorkload,
      };
    });
  }, [squadronEvents, disciplines, selectedYear, yearDisciplines]);

  return (
    <div className="p-6 md:p-12 pt-12 md:pt-20 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1
          className={`text-3xl  tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
        >
          Visão Geral do Esquadrão
        </h1>
        <p
          className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
        >
          {selectedYear}º Esquadrão
          {getCohortName(selectedYear) && (
            <span style={{ color: currentCohortColor.primary }}>
              {" "}
              - {getCohortName(selectedYear)}
            </span>
          )}
        </p>
      </header>

      {/* Squadron Selector */}
      <div
        className={`flex gap-2 mb-8 p-1 rounded-xl shadow-sm border w-full md:w-fit overflow-x-auto ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
      >
        {[1, 2, 3, 4].map((year) => {
          const yearColor = getCohortColorTokens(
            getCohortColor(year as CourseYear),
            theme,
          );
          const isSelected = selectedYear === year;
          return (
            <button
              key={year}
              onClick={() => setSelectedYear(year as CourseYear)}
              className={`px-6 py-2 rounded-lg text-sm  transition-all ${
                isSelected
                  ? "text-white shadow-md"
                  : theme === "dark"
                    ? "text-slate-400 hover:bg-slate-700"
                    : "text-slate-600 hover:bg-slate-50"
              }`}
              style={isSelected ? { backgroundColor: yearColor.primary } : {}}
            >
              {year}º Esquadrão
            </button>
          );
        })}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={BookOpen}
          label="Disciplinas (Ano)"
          value={stats.disciplinesCount}
          colorClass={theme === "dark" ? "text-blue-400" : "text-blue-600"}
          bgClass={theme === "dark" ? "bg-blue-900/20" : "bg-blue-50"}
          theme={theme}
        />
        <StatCard
          icon={Clock}
          label="Carga Horária Total"
          value={`${stats.totalLoad}h`}
          subtext="Soma de todas as disciplinas"
          colorClass={
            theme === "dark" ? "text-emerald-400" : "text-emerald-600"
          }
          bgClass={theme === "dark" ? "bg-emerald-900/20" : "bg-emerald-50"}
          theme={theme}
        />
        <StatCard
          icon={CalendarIcon}
          label="Eventos Totais"
          value={stats.eventsCount}
          colorClass={theme === "dark" ? "text-violet-400" : "text-violet-600"}
          bgClass={theme === "dark" ? "bg-violet-900/20" : "bg-violet-50"}
          theme={theme}
        />
        <StatCard
          icon={Shield}
          label="Dias Bloqueados"
          value={stats.blockedDays}
          colorClass={theme === "dark" ? "text-amber-400" : "text-amber-600"}
          bgClass={theme === "dark" ? "bg-amber-900/20" : "bg-amber-50"}
          theme={theme}
        />
      </div>

      {/* Carga Horária por Curso */}
      <div
        className={`mb-8 p-6 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
      >
        <h2
          className={`text-lg  mb-4 flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
        >
          <Clock size={20} className="text-slate-400" />
          Carga Horária por Curso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className={`flex items-center gap-4 p-4 rounded-lg border ${theme === "dark" ? "bg-slate-900/20 border-slate-900/30" : "bg-slate-50 border-slate-100"}`}
          >
            <div
              className={`p-3 rounded-full ${theme === "dark" ? "bg-sky-900/40 text-sky-400" : "bg-sky-100 text-sky-600"}`}
            >
              <Plane size={24} />
            </div>
            <div>
              <p
                className={`text-sm  ${theme === "dark" ? "text-slate-300" : "text-slate-900"}`}
              >
                Aviação
              </p>
              <p
                className={`text-2xl  ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}
              >
                {stats.loadByCourse.CFOAv}h
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-4 p-4 rounded-lg border ${theme === "dark" ? "bg-amber-900/20 border-amber-900/30" : "bg-amber-50 border-amber-100"}`}
          >
            <div
              className={`p-3 rounded-full ${theme === "dark" ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-600"}`}
            >
              <Briefcase size={24} />
            </div>
            <div>
              <p
                className={`text-sm  ${theme === "dark" ? "text-amber-300" : "text-amber-900"}`}
              >
                Intendência
              </p>
              <p
                className={`text-2xl  ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}
              >
                {stats.loadByCourse.CFOInt}h
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-4 p-4 rounded-lg border ${theme === "dark" ? "bg-amber-900/20 border-amber-900/30" : "bg-amber-900/50 border-amber-900"}`}
          >
            <div
              className={`p-3 rounded-full ${theme === "dark" ? "bg-green-900/40 text-green-400" : "bg-green-100 text-green-600"}`}
            >
              <Shield size={24} />
            </div>
            <div>
              <p
                className={`text-sm  ${theme === "dark" ? "text-amber-800" : "text-amber-900"}`}
              >
                Infantaria
              </p>
              <p
                className={`text-2xl  ${theme === "dark" ? "text-amber-700" : "text-amber-800"}`}
              >
                {stats.loadByCourse.CFOInf}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Class Cards - ALL 6 classes */}
      <div className="mb-8">
        <h2
          className={`text-xl  mb-4 ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
        >
          Turmas do {selectedYear}º Esquadrão
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {classStats.map(
            ({ classId, courseType, eventsCount, disciplinesCount }) => {
              const Icon = getCourseIcon(courseType);

              let colorScheme = "";
              if (theme === "dark") {
                if (courseType === "CFOAv")
                  colorScheme =
                    "bg-slate-900/20 border-slate-800 text-slate-300";
                else if (courseType === "CFOInt")
                  colorScheme =
                    "bg-amber-900/20 border-amber-800 text-amber-300";
                else if (courseType === "CFOInf")
                  colorScheme = "bg-amber-900 border-amber-950 text-white";
                else
                  colorScheme = "bg-slate-800 border-slate-700 text-slate-300";
              } else {
                if (courseType === "CFOAv")
                  colorScheme = "bg-slate-50 border-slate-200 text-slate-700";
                else if (courseType === "CFOInt")
                  colorScheme = "bg-amber-50 border-amber-200 text-amber-700";
                else if (courseType === "CFOInf")
                  colorScheme = "bg-amber-900 border-amber-950 text-white";
                else
                  colorScheme = "bg-slate-50 border-slate-200 text-slate-700";
              }

              return (
                <div
                  key={classId}
                  className={`border-2 ${colorScheme} p-4 rounded-xl hover:shadow-md transition-shadow`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`p-2 rounded-lg mb-2 ${
                        theme === "dark"
                          ? courseType === "CFOAv"
                            ? "bg-slate-900/50 text-slate-400"
                            : courseType === "CFOInt"
                              ? "bg-amber-900/50 text-amber-400"
                              : courseType === "CFOInf"
                                ? "bg-amber-900 text-white"
                                : "bg-slate-700 text-slate-400"
                          : courseType === "CFOAv"
                            ? "bg-slate-100 text-slate-600"
                            : courseType === "CFOInt"
                              ? "bg-amber-100 text-amber-600"
                              : courseType === "CFOInf"
                                ? "bg-amber-900 text-white"
                                : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <h3
                      className={`text-xl  mb-1 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                    >
                      {classId}
                    </h3>
                    <p
                      className={`text-[10px]  mb-3 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {getCourseLabel(courseType)}
                    </p>

                    <div className="w-full space-y-2">
                      <div
                        className={`p-2 rounded ${theme === "dark" ? "bg-slate-900/50" : "bg-white/70"}`}
                      >
                        <p
                          className={`text-[10px]  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Disciplinas
                        </p>
                        <p
                          className={`text-lg  ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                        >
                          {disciplinesCount}
                        </p>
                      </div>
                      <div
                        className={`p-2 rounded ${theme === "dark" ? "bg-slate-900/50" : "bg-white/70"}`}
                      >
                        <p
                          className={`text-[10px]  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Aulas Planejadas
                        </p>
                        <p
                          className={`text-lg  ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                        >
                          {eventsCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
};
