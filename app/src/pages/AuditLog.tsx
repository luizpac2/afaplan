import { useState, useMemo, useEffect } from "react";
import { Download, Filter } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuditStore } from "../store/useAuditStore";
import { exportToCSV, formatChanges } from "../utils/auditLogger";
import { Badge } from "../components/common/Badge";
import type { BadgeVariant } from "../components/common/Badge";
import type { AuditAction, AuditEntity } from "../types/auditLog";

export const AuditLog = () => {
  const { logs, loading, hasMore, fetchLogs, loadMoreLogs } = useAuditStore();
  const { theme } = useTheme();
  const [filterAction, setFilterAction] = useState<AuditAction | "ALL">("ALL");
  const [filterEntity, setFilterEntity] = useState<AuditEntity | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction =
        filterAction === "ALL" || log.action === filterAction;
      const matchesEntity =
        filterEntity === "ALL" || log.entity === filterEntity;
      const matchesSearch =
        !searchTerm ||
        log.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entityId.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesAction && matchesEntity && matchesSearch;
    });
  }, [logs, filterAction, filterEntity, searchTerm]);

  const getActionVariant = (action: AuditAction): BadgeVariant => {
    switch (action) {
      case "ADD":
        return "green";
      case "UPDATE":
        return "orange";
      case "DELETE":
        return "red";
      case "IMPORT":
        return "blue";
      default:
        return "slate";
    }
  };

  const getEntityLabel = (entity: AuditEntity) => {
    const labels: Record<AuditEntity, string> = {
      USER: "Usuário",
      DISCIPLINE: "Disciplina",
      EVENT: "Evento",
      CLASS: "Turma",
      COHORT: "Coorte",
      NOTICE: "Aviso",
      VISUAL_CONFIG: "Estilo Visual",
      INSTRUCTOR: "Docente",
      OCCURRENCE: "Ocorrência",
      SYSTEM_CONFIG: "Configurações",
      CSV: "Arquivo CSV",
      SQUADRON_EVENTS: "Eventos do Esquadrão",
    };
    return labels[entity] || "Desconhecido";
  };

  const getActionLabel = (action: AuditAction) => {
    const labels: Record<AuditAction, string> = {
      ADD: "Adicionou",
      UPDATE: "Alterou",
      DELETE: "Deletou",
      IMPORT: "Importou",
    };
    return labels[action];
  };

  return (
    <div className="p-4 md:p-6 md:h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
          <h1
            className={`text-3xl  tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            Histórico de Alterações
          </h1>
          <p
            className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            Visualize todas as ações realizadas no sistema. Total: {logs.length}{" "}
            registros
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => exportToCSV(logs)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm "
            disabled={logs.length === 0}
          >
            <Download size={20} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`p-4 rounded-lg shadow-sm border mb-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter
              size={18}
              className={theme === "dark" ? "text-slate-500" : "text-slate-400"}
            />
            <span
              className={`text-sm  ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              Filtros:
            </span>
          </div>

          <input
            type="text"
            placeholder="Buscar por nome ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"}`}
          />

          <select
            value={filterAction}
            onChange={(e) =>
              setFilterAction(e.target.value as AuditAction | "ALL")
            }
            className={`px-3 py-2 border rounded-lg text-sm  outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
          >
            <option value="ALL">Todas as Ações</option>
            <option value="ADD">Adicionou</option>
            <option value="UPDATE">Atualizou</option>
            <option value="DELETE">Deletou</option>
          </select>

          <select
            value={filterEntity}
            onChange={(e) =>
              setFilterEntity(e.target.value as AuditEntity | "ALL")
            }
            className={`px-3 py-2 border rounded-lg text-sm  outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
          >
            <option value="ALL">Todas as Entidades</option>
            <option value="USER">Usuários</option>
            <option value="DISCIPLINE">Disciplinas</option>
            <option value="EVENT">Eventos</option>
            <option value="CLASS">Turmas</option>
            <option value="COHORT">Coortes</option>
          </select>

          {(filterAction !== "ALL" || filterEntity !== "ALL" || searchTerm) && (
            <button
              onClick={() => {
                setFilterAction("ALL");
                setFilterEntity("ALL");
                setSearchTerm("");
              }}
              className={`text-sm  hover:underline ${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div
        className={`flex-1 rounded-xl shadow-sm border md:overflow-hidden flex flex-col ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`flex items-center justify-center h-64 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
          >
            <div className="text-center">
              <p className="text-lg ">Nenhum registro encontrado</p>
              <p className="text-sm mt-2">
                {logs.length === 0
                  ? "O histórico está vazio. Comece fazendo alterações no sistema."
                  : "Tente ajustar os filtros para ver mais resultados."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead
                  className={`border-b sticky top-0 ${theme === "dark" ? "bg-slate-700/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
                >
                  <tr>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Data/Hora
                    </th>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Usuário
                    </th>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Ação
                    </th>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Tipo
                    </th>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Nome
                    </th>
                    <th
                      className={`text-left px-4 py-3 text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Alterações
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
                >
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`transition-colors ${theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}
                    >
                      <td
                        className={`px-4 py-3 text-sm whitespace-nowrap ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {new Date(log.timestamp).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm  ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs  ${theme === "dark" ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-600"}`}
                          >
                            {(log.user || "A").charAt(0).toUpperCase()}
                          </div>
                          {log.user || "Administrador"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getActionVariant(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-sm  ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                      >
                        {getEntityLabel(log.entity)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
                      >
                        {log.entityName || log.entityId}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {log.action === "ADD"
                          ? `Criou ${log.entityName || log.entityId}`
                          : log.action === "DELETE"
                            ? `Removeu ${log.entityName || log.entityId}`
                            : log.changes
                              ? formatChanges(
                                  log.changes.before,
                                  log.changes.after,
                                ) || "—"
                              : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div
                className={`p-4 border-t flex justify-center ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
              >
                <button
                  onClick={loadMoreLogs}
                  disabled={loading}
                  className={`px-6 py-2 rounded-lg  transition-all shadow-sm flex items-center gap-2 ${
                    theme === "dark"
                      ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  } disabled:opacity-50`}
                >
                  {loading ? "Carregando..." : "Carregar mais logs"}
                </button>
              </div>
            )}

            {!hasMore && logs.length > 0 && (
              <div
                className={`p-4 border-t text-center text-sm ${theme === "dark" ? "text-slate-500 border-slate-700" : "text-slate-400 border-slate-200"}`}
              >
                Fim do histórico de auditoria
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
