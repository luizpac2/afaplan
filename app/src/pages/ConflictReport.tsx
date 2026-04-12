import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  Filter,
  Download,
  CalendarCheck,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { detectConflicts } from "../utils/schedulingEngine";
import type { Conflict } from "../utils/schedulingEngine";
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
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());
  const [suggestionModal, setSuggestionModal] = useState<{ text: string } | null>(null);
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

  const toggleSuggestions = (idx: number) => {
    setExpandedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSuggestionAction = (conflict: Conflict, suggestionIdx: number) => {
    const suggestion = conflict.suggestions?.[suggestionIdx];
    if (!suggestion) return;
    if (suggestion.action === 'navigate' && suggestion.payload) {
      navigate(suggestion.payload);
    } else if (suggestion.action === 'info' && suggestion.payload) {
      setSuggestionModal({ text: suggestion.payload });
    }
  };

  const handleResolve = (conflict: Conflict) => {
    if (!conflict.classId) return;
    // Extract squadron number from classId (e.g. "1E" → "1", "4" → "4")
    const firstChar = conflict.classId.charAt(0);
    const squadronId = /^\d$/.test(firstChar) ? firstChar : "1";
    const dateParam = conflict.date ? `?date=${conflict.date}` : "";
    navigate(`/gantt/${squadronId}${dateParam}`);
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
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredConflicts.map((conflict, idx) => {
              const hasSuggestions = conflict.suggestions && conflict.suggestions.length > 0;
              const isExpanded = expandedSuggestions.has(idx);
              return (
                <div
                  key={idx}
                  className={`p-4 transition-colors ${theme === "dark" ? "hover:bg-slate-700/30" : "hover:bg-slate-50"}`}
                >
                  {/* Main row */}
                  <div className="flex items-start gap-3">
                    {/* Severity badge */}
                    <span
                      className={`flex-shrink-0 mt-0.5 inline-flex px-2 py-1 rounded-full text-xs border ${severityBadgeColor(conflict.severity)}`}
                    >
                      {conflict.severity === "error" ? "Erro" : "Aviso"}
                    </span>

                    {/* Type + message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-medium uppercase tracking-wide ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                          {conflictTypeLabel(conflict.type)}
                        </span>
                        {conflict.classId && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                            {formatClassLabel(conflict.classId)}
                          </span>
                        )}
                        {conflict.date && (
                          <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                            {new Date(conflict.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {conflict.timeSlot && conflict.timeSlot !== "Total" ? ` · ${conflict.timeSlot}` : ""}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                        {conflict.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {conflict.classId && (
                        <button
                          onClick={() => handleResolve(conflict)}
                          className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors border ${theme === "dark" ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 border-blue-800" : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"}`}
                        >
                          Ver na Grade
                        </button>
                      )}
                      {hasSuggestions && (
                        <button
                          onClick={() => toggleSuggestions(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors border ${theme === "dark" ? "bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 border-amber-800" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"}`}
                        >
                          <Lightbulb size={12} />
                          Sugestões
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Suggestions panel */}
                  {hasSuggestions && isExpanded && (
                    <div className={`mt-3 ml-16 p-3 rounded-lg border ${theme === "dark" ? "bg-amber-900/10 border-amber-800/50" : "bg-amber-50 border-amber-200"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}>
                        <Lightbulb size={12} />
                        Como resolver
                      </p>
                      <div className="flex flex-col gap-2">
                        {conflict.suggestions!.map((s, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2">
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${theme === "dark" ? "bg-amber-800/50 text-amber-300" : "bg-amber-200 text-amber-800"}`}>
                              {sIdx + 1}
                            </span>
                            {s.action === 'navigate' ? (
                              <button
                                onClick={() => handleSuggestionAction(conflict, sIdx)}
                                className={`text-sm text-left underline underline-offset-2 ${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"}`}
                              >
                                {s.label} →
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuggestionAction(conflict, sIdx)}
                                className={`text-sm text-left ${theme === "dark" ? "text-amber-200 hover:text-amber-100" : "text-amber-800 hover:text-amber-900"}`}
                              >
                                <strong>{s.label}:</strong> {s.payload}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggestion info modal */}
      {suggestionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSuggestionModal(null)}
        >
          <div
            className={`max-w-md w-full mx-4 p-6 rounded-xl shadow-xl border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <Lightbulb className={`flex-shrink-0 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`} size={20} />
              <h3 className={`font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                Sugestão de Resolução
              </h3>
            </div>
            <p className={`text-sm leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              {suggestionModal.text}
            </p>
            <button
              onClick={() => setSuggestionModal(null)}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
