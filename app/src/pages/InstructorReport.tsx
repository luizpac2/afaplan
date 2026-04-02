import { useMemo, useState, useEffect } from "react";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import {
  BookOpen,
  Calendar,
  MapPin,
  Printer,
  Search,
  User,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { formatDateForDisplay } from "../utils/dateUtils";
import { useTheme } from "../contexts/ThemeContext";
import { Badge } from "../components/common/Badge";
import type { ScheduleEvent, Discipline } from "../types";

export const InstructorReport = () => {
  const { disciplines, fetchYearlyEvents } = useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  // Default tab changed to 'schedule' as requested
  const [activeTab, setActiveTab] = useState<"schedule" | "disciplines">(
    "schedule",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedInstructorName, setSelectedInstructorName] = useState<string>(
    () => {
      return localStorage.getItem("afa_planner_linked_instructor") || "";
    },
  );
  const [linkedInstructor, setLinkedInstructor] = useState<string | null>(
    () => {
      return localStorage.getItem("afa_planner_linked_instructor");
    },
  );

  // Window Query state
  const [yearEvents, setYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    fetchYearlyEvents(selectedYear).then((data) => {
      setYearEvents(data);
    });
  }, [selectedYear, fetchYearlyEvents]);

  const handleLinkInstructor = () => {
    if (selectedInstructorName) {
      localStorage.setItem(
        "afa_planner_linked_instructor",
        selectedInstructorName,
      );
      setLinkedInstructor(selectedInstructorName);
      alert(
        `Perfil vinculado a: ${selectedInstructorName}. Sua agenda abrirá automaticamente.`,
      );
    }
  };

  const handleUnlinkInstructor = () => {
    localStorage.removeItem("afa_planner_linked_instructor");
    setLinkedInstructor(null);
    alert("Vínculo removido.");
  };

  // Derive unique instructors from disciplines (requested by user)
  const availableInstructors = useMemo(() => {
    if (!Array.isArray(disciplines)) return [];
    const names = disciplines
      .map((d: Discipline) => d.instructor)
      .filter(
        (name): name is string =>
          typeof name === "string" && name.trim() !== "",
      );

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [disciplines]);

  // Early returns moved to bottom to satisfy Rules of Hooks

  // Determine target instructor
  const isViewAllMode =
    ["SUPER_ADMIN", "ADMIN", "DOCENTE"].includes(userProfile?.role || "") &&
    selectedInstructorName;
  const targetInstructorName = isViewAllMode
    ? selectedInstructorName
    : userProfile?.displayName;

  // Helper for safe date
  const safeDate = (dateStr: string) => {
    if (!dateStr) return "Data não definida";
    try {
      const formatted = formatDateForDisplay(dateStr);
      if (!formatted) return "Data Inválida";
      return formatted;
    } catch {
      return "Erro na Data";
    }
  };

  // Filter disciplines by instructor - ROBUST FILTER
  const myDisciplines = useMemo(() => {
    if (!targetInstructorName || !Array.isArray(disciplines)) return [];

    const cleanInstructorName = (targetInstructorName || "").toLowerCase().trim();

    return disciplines.filter((d: Discipline) => {
      if (!d || !d.instructor) return false;
      // Handle case where instructor might be comma separated or just a single name
      const dInstructor = String(d.instructor).toLowerCase();
      return dInstructor.includes(cleanInstructorName);
    });
  }, [disciplines, targetInstructorName]);

  // Filter events by my disciplines - ROBUST FILTER
  const myEvents = useMemo(() => {
    if (!Array.isArray(yearEvents) || myDisciplines.length === 0) return [];

    const myDisciplineIds = myDisciplines.map((d: Discipline) => d.id);

    return yearEvents
      .filter((e) => {
        if (!e || !e.disciplineId) return false;
        return myDisciplineIds.includes(e.disciplineId);
      })
      .sort((a: ScheduleEvent, b: ScheduleEvent) => {
        // Safe Sort
        const dateA = new Date(a.date || "").getTime() || 0;
        const dateB = new Date(b.date || "").getTime() || 0;
        return dateA - dateB;
      });
  }, [yearEvents, myDisciplines]);

  // Calculate Stats - SAFE MATH
  // Calculate Stats - SAFE MATH
  // totalLoad removed as per request

  const totalClasses = myEvents.length;

  const filteredEvents = myEvents.filter((e) => {
    const discipline = disciplines.find((d) => d.id === e.disciplineId);
    const searchString =
      `${discipline?.name || ""} ${e.date || ""} ${e.location || ""}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-slate-500 animate-pulse">Carregando perfil...</div>
      </div>
    );
  }

  // Strict Role Check - Security Patch
  if (!["SUPER_ADMIN", "ADMIN", "DOCENTE"].includes(userProfile.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
        <p className="mb-2 text-lg  text-red-500">Acesso Negado</p>
        <p>
          O perfil <strong>{userProfile.role}</strong> não tem permissão para
          visualizar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-agenda, #printable-agenda * {
                        visibility: visible;
                    }
                    #printable-agenda {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                        padding: 20px;
                    }
                    .print-header {
                        display: block !important;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #eee;
                        padding-bottom: 10px;
                    }
                    /* Ensure table looks good on print */
                    table {
                        width: 100% !important;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f8f9fa !important;
                        -webkit-print-color-adjust: exact;
                    }
                }
                .print-header {
                    display: none;
                }
            `}</style>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className={`text-2xl md:text-3xl  tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            Painel do Docente
          </h1>
          <p
            className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            Acompanhe as atividades e carga horária.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-32">
            <label
              className={`block text-xs  uppercase mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Ano Letivo:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`w-full appearance-none border py-2 px-3 rounded-lg leading-tight focus:outline-none focus:border-blue-500 shadow-sm ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-700"}`}
            >
              {Array.from(
                { length: 5 },
                (_, i) => new Date().getFullYear() - 1 + i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-72">
            <label
              className={`block text-xs  uppercase mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Visualizar como:
            </label>
            <div className="relative">
              <select
                value={selectedInstructorName}
                onChange={(e) => setSelectedInstructorName(e.target.value)}
                className={`w-full appearance-none border py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:border-blue-500 shadow-sm custom-select ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-800" : "bg-white border-slate-300 text-slate-700 focus:bg-white"}`}
              >
                <option value="">{userProfile?.displayName} (Eu)</option>
                {availableInstructors.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}
              >
                <Search size={16} />
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              {linkedInstructor === selectedInstructorName ? (
                <button
                  onClick={handleUnlinkInstructor}
                  className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors"
                  title="Remover vínculo automático"
                >
                  <Unlink size={12} />
                  Desvincular de mim
                </button>
              ) : (
                selectedInstructorName && (
                  <button
                    onClick={handleLinkInstructor}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Definir como meu perfil padrão"
                  >
                    <LinkIcon size={12} />
                    Este sou eu
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${theme === "dark" ? "bg-blue-900/20 border-blue-800/50" : "bg-blue-50/50 border-blue-100"}`}
      >
        <div
          className={`p-2 rounded-full ${theme === "dark" ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-600"}`}
        >
          <User size={20} />
        </div>
        <div>
          <p
            className={`text-sm  ${theme === "dark" ? "text-blue-300" : "text-blue-900"}`}
          >
            Visualizando:{" "}
            <span className="">
              {targetInstructorName || "Ninguém selecionado"}
            </span>
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
        <div
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
        >
          <div
            className={`p-3 rounded-lg ${theme === "dark" ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"}`}
          >
            <BookOpen size={24} />
          </div>
          <div>
            <p
              className={`text-sm  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Disciplinas Atribuídas
            </p>
            <h3
              className={`text-2xl  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
            >
              {myDisciplines.length}
            </h3>
          </div>
        </div>

        <div
          className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
        >
          <div
            className={`p-3 rounded-lg ${theme === "dark" ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"}`}
          >
            <Calendar size={24} />
          </div>
          <div>
            <p
              className={`text-sm  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Total de Aulas Alocadas
            </p>
            <h3
              className={`text-2xl  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
            >
              {totalClasses}
            </h3>
          </div>
        </div>
      </div>

      {/* Tabs - SWAPPED ORDER */}
      <div
        className={`flex border-b mb-6 overflow-x-auto ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
      >
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-6 py-3  text-sm transition-colors relative whitespace-nowrap ${
            activeTab === "schedule"
              ? theme === "dark"
                ? "text-blue-400"
                : "text-blue-600"
              : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Agenda de Aulas
          {activeTab === "schedule" && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${theme === "dark" ? "bg-blue-400" : "bg-blue-600"}`}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab("disciplines")}
          className={`px-6 py-3  text-sm transition-colors relative whitespace-nowrap ${
            activeTab === "disciplines"
              ? theme === "dark"
                ? "text-blue-400"
                : "text-blue-600"
              : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Minhas Disciplinas
          {activeTab === "disciplines" && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${theme === "dark" ? "bg-blue-400" : "bg-blue-600"}`}
            />
          )}
        </button>
      </div>

      {/* Content */}
      <div
        className={`rounded-xl shadow-sm border overflow-hidden ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
      >
        {activeTab === "disciplines" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead
                className={`uppercase  ${theme === "dark" ? "bg-slate-700/50 text-slate-400" : "bg-slate-50 text-slate-500"}`}
              >
                <tr>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Turma(s)</th>
                  <th className="px-6 py-4 text-right">Aulas Alocadas</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
              >
                {myDisciplines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className={`px-6 py-8 text-center ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Nenhuma disciplina encontrada vinculada ao seu nome (
                      {targetInstructorName}).
                    </td>
                  </tr>
                ) : (
                  myDisciplines.map((discipline) => {
                    const classCount = yearEvents.filter(
                      (e) => e.disciplineId === discipline.id,
                    ).length;

                    return (
                      <tr
                        key={discipline.id}
                        className={`transition-colors ${theme === "dark" ? "hover:bg-slate-700/30" : "hover:bg-slate-50/50"}`}
                      >
                        <td
                          className={`px-6 py-4 font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                        >
                          {discipline.code}
                        </td>
                        <td
                          className={`px-6 py-4  ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
                        >
                          {discipline.name}
                        </td>
                        <td
                          className={`px-6 py-4 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                        >
                          {discipline.year === "ALL"
                            ? "Todos os Esquadrões"
                            : `${discipline.year}º Esquadrão`}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-mono  ${theme === "dark" ? "text-slate-400 bg-blue-900/10 text-blue-400" : "text-slate-600 bg-blue-50/30 text-blue-700"}`}
                        >
                          {classCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            {/* Search Toolbar */}
            <div
              className={`p-4 border-b flex gap-4 ${theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-100 bg-slate-50/50"}`}
            >
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar aula por disciplina, data ou local..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}
                />
              </div>
              <button
                onClick={() => window.print()}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm  shadow-sm ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                title="Imprimir Agenda"
              >
                <Printer size={18} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>

            <div id="printable-agenda" className="overflow-x-auto">
              <div className="print-header">
                <h1 className="text-2xl  text-slate-900">Agenda de Aulas</h1>
                <p className="text-slate-600 text-lg">
                  Docente: {targetInstructorName}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Gerado em: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
              <table className="w-full text-sm text-left">
                <thead
                  className={`uppercase  ${theme === "dark" ? "bg-slate-700/50 text-slate-400" : "bg-slate-50 text-slate-500"}`}
                >
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Horário</th>
                    <th className="px-6 py-4">Disciplina</th>
                    <th className="px-6 py-4">Turma</th>
                    <th className="px-6 py-4">Local</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
                >
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={`px-6 py-8 text-center ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Nenhuma aula encontrada na agenda.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((event) => {
                      const discipline = disciplines.find(
                        (d) => d.id === event.disciplineId,
                      );
                      // Safe Date Check for 'isPast'
                      const eventDate = new Date(event.date || "");
                      const isPast =
                        !isNaN(eventDate.getTime()) && eventDate < new Date();

                      return (
                        <tr
                          key={event.id}
                          className={`transition-colors ${isPast ? (theme === "dark" ? "bg-slate-800/50 opacity-75" : "bg-slate-50/50 opacity-75") : theme === "dark" ? "hover:bg-blue-900/10" : "hover:bg-blue-50/30"}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-slate-400" />
                              <span
                                className={` ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                              >
                                {safeDate(event.date)}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {event.startTime} - {event.endTime}
                          </td>
                          <td
                            className={`px-6 py-4  ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
                          >
                            {discipline?.name || "Disciplina Removida"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="slate">
                              {event.classId === "Geral"
                                ? "Todas"
                                : event.classId}
                            </Badge>
                          </td>
                          <td
                            className={`px-6 py-4 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                size={14}
                                className="text-slate-400 dark:text-slate-500"
                              />
                              {event.type === "ACADEMIC"
                                ? event.location
                                : discipline?.location || "a definir"}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
