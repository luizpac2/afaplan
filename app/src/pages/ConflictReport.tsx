import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  Filter,
  Download,
  CalendarCheck,
  Loader2,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { detectConflicts } from "../utils/schedulingEngine";
import { EmptyState } from "../components/EmptyState";
import { useNavigate } from "react-router-dom";
import type { ScheduleEvent } from "../types";

export const ConflictReport = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { disciplines, semesterConfigs, dataReady, fetchYearlyEvents } =
    useCourseStore();
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterSquadron, setFilterSquadron] = useState<string>("ALL");
  // Local state for events to enable real-time updates
  const [yearEvents, setYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    if (!dataReady) return;
    setIsLoading(true);

    fetchYearlyEvents(selectedYear).then((data) => {
      setYearEvents(data);
      setIsLoading(false);
    });
  }, [selectedYear, dataReady, fetchYearlyEvents]);

  // Detect all conflicts
  const allConflicts = useMemo(() => {
    return detectConflicts(yearEvents, disciplines, semesterConfigs);
  }, [yearEvents, disciplines, semesterConfigs]);

  // Apply filters
  const filteredConflicts = useMemo(() => {
    return allConflicts.filter((conflict) => {
      if (filterType !== "ALL" && conflict.type !== filterType) return false;
      if (filterSeverity !== "ALL" && conflict.severity !== filterSeverity)
        return false;
      if (filterSquadron !== "ALL") {
        if (!conflict.classId?.startsWith(filterSquadron)) return false;
      }
      return true;
    });
  }, [allConflicts, filterType, filterSeverity, filterSquadron]);

  const conflictTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      overlap: "Sobreposição de Horário",
      overload: "Carga Horária Excedida",
      restriction: "Violação de Restrição",
      distribution: "Distribuição Irregular",
    };
    return labels[type] || type;
  };

  const formatClassLabel = (classId: string | undefined) => {
    if (!classId) return "-";
    if (classId === "ALL") return "Geral";

    // Handle special IDs like 4AVIATION, 4INFANTRY, 4INTENDANCY
    if (classId.includes("AVIATION")) return `${classId.charAt(0)}º Aviação`;
    if (classId.includes("INFANTRY")) return `${classId.charAt(0)}º Infantaria`;
    if (classId.includes("INTENDANCY"))
      return `${classId.charAt(0)}º Intendência`;

    // Handle standard IDs like 1A, 2B
    if (/^\d[A-Z]$/.test(classId)) {
      return `${classId.charAt(0)}º ${classId.charAt(1)}`;
    }

    return classId;
  };

  const severityBadgeColor = (severity: string) => {
    if (theme === "dark") {
      return severity === "error"
        ? "bg-red-900/30 text-red-400 border-red-800"
        : "bg-amber-900/30 text-amber-400 border-amber-800";
    }
    return severity === "error"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-amber-100 text-amber-700 border-amber-200";
  };

  const handleExport = () => {
    const csvContent = [
      [
        "Tipo",
        "Severidade",
        "Turma",
        "Ano",
        "Data",
        "Horário",
        "Mensagem",
      ].join(","),
      ...filteredConflicts.map((c) =>
        [
          conflictTypeLabel(c.type),
          c.severity === "error" ? "Erro" : "Aviso",
          c.classId || "-",
          c.year || "-",
          c.date || "-",
          c.timeSlot || "-",
          `"${c.message}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-conflitos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleResolve = (conflict: any) => {
    if (!conflict.classId) return;

    // Extract squadron from classId (e.g. "1A" -> "1")
    // If it starts with a number, use it. Otherwise default to 1 or handle "Geral"
    const squadronChar = conflict.classId.charAt(0);
    const squadronId = isNaN(parseInt(squadronChar)) ? "1" : squadronChar;

    const dateParam = conflict.date ? `?date=${conflict.date}` : "";
    navigate(`/programming/${squadronId}${dateParam}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1
            className={`text-3xl font-bold tracking-tight flex items-center gap-3 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            <AlertTriangle className="text-amber-600" size={32} />
            Relatório de Conflitos
          </h1>
          {isLoading && (
            <div className="flex items-center justify-center p-1.5 bg-blue-500/10 rounded-xl animate-pulse">
              <Loader2 className="animate-spin text-blue-500" size={20} />
            </div>
          )}
        </div>
        <p
          className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
        >
          Análise de conflitos e problemas na programação atual
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          className={`rounded-lg shadow-sm border p-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
        >
          <p
            className={`text-sm  ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
          >
            Total de Conflitos
          </p>
          <p
            className={`text-3xl  mt-1 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            {allConflicts.length}
          </p>
        </div>
        <div
          className={`rounded-lg shadow-sm border p-4 ${theme === "dark" ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"}`}
        >
          <p
            className={`text-sm  ${theme === "dark" ? "text-red-400" : "text-red-700"}`}
          >
            Erros Críticos
          </p>
          <p
            className={`text-3xl  mt-1 ${theme === "dark" ? "text-red-400" : "text-red-700"}`}
          >
            {allConflicts.filter((c) => c.severity === "error").length}
          </p>
        </div>
        <div
          className={`rounded-lg shadow-sm border p-4 ${theme === "dark" ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}
        >
          <p
            className={`text-sm  ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}
          >
            Avisos
          </p>
          <p
            className={`text-3xl  mt-1 ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}
          >
            {allConflicts.filter((c) => c.severity === "warning").length}
          </p>
        </div>
        <div
          className={`rounded-lg shadow-sm border p-4 ${theme === "dark" ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-200"}`}
        >
          <p
            className={`text-sm  ${theme === "dark" ? "text-blue-400" : "text-blue-700"}`}
          >
            Sobreposições
          </p>
          <p
            className={`text-3xl  mt-1 ${theme === "dark" ? "text-blue-400" : "text-blue-700"}`}
          >
            {allConflicts.filter((c) => c.type === "overlap").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`rounded-lg shadow-sm border p-4 mb-6 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter
            size={18}
            className={theme === "dark" ? "text-slate-400" : "text-slate-600"}
          />
          <h3
            className={` ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            Filtros
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label
              className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              Ano Letivo
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-900"}`}
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
          <div>
            <label
              className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              Tipo
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-900"}`}
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="overlap">Sobreposição</option>
              <option value="overload">Carga Excedida</option>
              <option value="restriction">Restrição Violada</option>
              <option value="distribution">Distribuição Irregular</option>
            </select>
          </div>
          <div>
            <label
              className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              Severidade
            </label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-900"}`}
            >
              <option value="ALL">Todas</option>
              <option value="error">Apenas Erros</option>
              <option value="warning">Apenas Avisos</option>
            </select>
          </div>
          <div>
            <label
              className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              Esquadrão
            </label>
            <select
              value={filterSquadron}
              onChange={(e) => setFilterSquadron(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-900"}`}
            >
              <option value="ALL">Todos</option>
              <option value="1">1º Esquadrão</option>
              <option value="2">2º Esquadrão</option>
              <option value="3">3º Esquadrão</option>
              <option value="4">4º Esquadrão</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={filteredConflicts.length === 0}
              className={`w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors  flex items-center justify-center gap-2 text-sm ${filteredConflicts.length === 0 ? (theme === "dark" ? "disabled:bg-slate-700 disabled:cursor-not-allowed" : "disabled:bg-slate-300 disabled:cursor-not-allowed") : ""}`}
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Conflicts List */}
      <div
        className={`rounded-lg shadow-sm border overflow-hidden ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        {filteredConflicts.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={
              allConflicts.length === 0
                ? "Nenhum Conflito Detectado"
                : "Nenhum Conflito Encontrado"
            }
            description={
              allConflicts.length === 0
                ? "Parabéns! Sua programação está 100% livre de conflitos."
                : "Tente ajustar os filtros para visualizar outros eventos."
            }
            actionLabel="Atualizar Programação"
            onAction={() => navigate("/programming/1")}
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar relative">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead
                className={`sticky top-0 z-20 border-b shadow-sm ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
              >
                <tr>
                  <th
                    className={`w-32 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Severidade
                  </th>
                  <th
                    className={`w-48 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Tipo
                  </th>
                  <th
                    className={`w-24 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Turma
                  </th>
                  <th
                    className={`w-28 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Ano
                  </th>
                  <th
                    className={`w-32 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Data
                  </th>
                  <th
                    className={`w-36 text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Horário
                  </th>
                  <th
                    className={`text-left p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Descrição
                  </th>
                  <th
                    className={`sticky right-0 z-30 w-32 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] backdrop-blur-sm border-l text-center p-4  text-xs uppercase tracking-wider ${theme === "dark" ? "bg-slate-800/90 text-slate-400 border-slate-700" : "bg-slate-50/90 text-slate-500 border-slate-200"}`}
                  >
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
              >
                {filteredConflicts.map((conflict, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-4 w-32">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs  border ${severityBadgeColor(conflict.severity)}`}
                      >
                        {conflict.severity === "error" ? "Erro" : "Aviso"}
                      </span>
                    </td>
                    <td
                      className={`p-4 text-sm w-48 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                    >
                      {conflictTypeLabel(conflict.type)}
                    </td>
                    <td
                      className={`p-4 text-sm  w-24 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                    >
                      {formatClassLabel(conflict.classId)}
                    </td>
                    <td
                      className={`p-4 text-sm w-28 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {conflict.year === "ALL"
                        ? "Geral"
                        : conflict.year
                          ? `${conflict.year}º Ano`
                          : "-"}
                    </td>
                    <td
                      className={`p-4 text-sm w-32 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {conflict.date
                        ? new Date(conflict.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "-"}
                    </td>
                    <td
                      className={`p-4 text-sm w-36 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {conflict.timeSlot || "-"}
                    </td>
                    <td
                      className={`p-4 text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                    >
                      {conflict.message}
                    </td>
                    <td
                      className={`sticky right-0 z-10 backdrop-blur-sm border-l shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] transition-colors p-4 w-32 text-center ${theme === "dark" ? "bg-slate-800/95 group-hover:bg-slate-700/90 border-slate-700" : "bg-white/95 group-hover:bg-slate-50/95 border-slate-100"}`}
                    >
                      {conflict.classId && (
                        <button
                          onClick={() => handleResolve(conflict)}
                          className={`px-3 py-1.5 rounded text-xs  whitespace-nowrap transition-colors border ${theme === "dark" ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 border-blue-800" : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"}`}
                        >
                          Ver Problema
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Section */}
      {filteredConflicts.length > 0 && (
        <div
          className={`mt-6 p-4 rounded-lg border ${theme === "dark" ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-200"}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={`flex-shrink-0 mt-0.5 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
              size={20}
            />
            <div
              className={`text-sm ${theme === "dark" ? "text-blue-200" : "text-blue-800"}`}
            >
              <p className=" mb-1">Como resolver conflitos:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Sobreposição:</strong> Remova ou realoque uma das
                  aulas conflitantes
                </li>
                <li>
                  <strong>Carga Excedida:</strong> Reduza o número de aulas ou
                  ajuste a carga horária da disciplina
                </li>
                <li>
                  <strong>Restrição Violada:</strong> Verifique a Ficha
                  Informativa e realoque para dias permitidos
                </li>
                <li>
                  <strong>Distribuição Irregular:</strong> Redistribua as aulas
                  de forma mais uniforme
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
