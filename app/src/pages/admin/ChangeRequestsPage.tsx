import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileEdit,
  Plus,
  Trash2,
  Eye,
  Link2,
  Search,
  AlertTriangle,
  FileDown,
  Download,
  Calendar,
  GitBranch,
  FileText,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCourseStore } from "../../store/useCourseStore";
import { ChangeRequestModal } from "../../components/ChangeRequestModal";
import { SAPReportModal } from "../../components/SAPReportModal";
import { exportSAPsToExcel, exportSAPsToPDF } from "../../utils/exportUtils";
import type { ScheduleChangeRequest, ChangeRequestStatus } from "../../types";

const STATUS_STYLES: Record<ChangeRequestStatus, string> = {
  PENDENTE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  APROVADA:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJEITADA: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  EXECUTADA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export const ChangeRequestsPage = () => {
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { changeRequests, deleteChangeRequest } = useCourseStore();
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] =
    useState<ScheduleChangeRequest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportSap, setReportSap] = useState<ScheduleChangeRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<ChangeRequestStatus | "ALL">(
    "ALL",
  );
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const canEdit = ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || "");

  const filtered = useMemo(() => {
    return changeRequests
      .filter((r) => {
        const matchSearch =
          r.numeroAlteracao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.motivo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === "ALL" || r.status === filterStatus;

        const date = new Date(r.dataSolicitacao);
        const matchDate =
          (!dateRange.start || date >= new Date(dateRange.start)) &&
          (!dateRange.end ||
            date <= new Date(new Date(dateRange.end).setHours(23, 59, 59)));

        return matchSearch && matchStatus && matchDate;
      })
      .sort(
        (a, b) =>
          new Date(b.dataSolicitacao).getTime() -
          new Date(a.dataSolicitacao).getTime(),
      );
  }, [changeRequests, searchTerm, filterStatus]);

  const handleDelete = async (req: ScheduleChangeRequest) => {
    if (
      !window.confirm(
        `Excluir a SAP "${req.numeroAlteracao}"? Isso não removerá vínculos dos eventos.`,
      )
    )
      return;
    await deleteChangeRequest(req.id);
  };

  const handleEdit = (req: ScheduleChangeRequest) => {
    setEditingRequest(req);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRequest(null);
  };

  const card = `rounded-xl border shadow-sm ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className={`text-2xl font-semibold flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
          >
            <FileEdit
              className={theme === "dark" ? "text-amber-400" : "text-amber-600"}
            />
            Solicitações de Alteração (SAP)
          </h1>
          <p
            className={`text-sm mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            Gerencie e rastreie as solicitações de alteração da programação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => exportSAPsToExcel(filtered)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${theme === "dark" ? "bg-slate-700 hover:bg-slate-600 text-slate-200" : "bg-white border-r hover:bg-slate-50 text-slate-700"}`}
              title="Exportar Excel"
            >
              <Download size={14} />
              Excel
            </button>
            <button
              onClick={() => exportSAPsToPDF(filtered)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${theme === "dark" ? "bg-slate-700 hover:bg-slate-600 text-slate-200 border-l border-slate-600" : "bg-white hover:bg-slate-50 text-slate-700"}`}
              title="Exportar PDF"
            >
              <FileDown size={14} />
              PDF
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
            >
              <Plus size={16} />
              Nova SAP
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            "PENDENTE",
            "APROVADA",
            "EXECUTADA",
            "REJEITADA",
          ] as ChangeRequestStatus[]
        ).map((s) => (
          <div
            key={s}
            className={
              card + " p-4 cursor-pointer hover:shadow-md transition-shadow"
            }
            onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wide ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              {s}
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
            >
              {changeRequests.filter((r) => r.status === s).length}
            </p>
          </div>
        ))}
      </div>

      <div className={`${card} p-4 flex flex-col md:flex-row gap-3`}>
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar por número, solicitante ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, start: e.target.value }))
              }
              className={`pl-8 pr-2 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-600"}`}
            />
          </div>
          <span className="text-slate-400 text-xs">até</span>
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, end: e.target.value }))
              }
              className={`pl-8 pr-2 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-600"}`}
            />
          </div>
        </div>

        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as ChangeRequestStatus | "ALL")
          }
          className={`p-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none transition-colors ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
        >
          <option value="ALL">Todos os Status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="APROVADA">Aprovada</option>
          <option value="EXECUTADA">Executada</option>
          <option value="REJEITADA">Rejeitada</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className={`${card} p-12 text-center`}>
            <AlertTriangle size={32} className="mx-auto mb-3 text-slate-300" />
            <p
              className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Nenhuma SAP encontrada.
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <div key={req.id} className={card + " overflow-hidden"}>
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-sm font-bold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
                    >
                      {req.numeroAlteracao}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}
                    >
                      {req.status}
                    </span>
                    <span
                      className={`text-xs flex items-center gap-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                    >
                      <Link2 size={10} />
                      {req.eventIds.length} aula(s)
                    </span>
                  </div>
                  <p
                    className={`text-xs ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    <span className="font-medium">Solicitante:</span>{" "}
                    {req.solicitante} •{" "}
                    <span className="font-medium">Motivo:</span> {req.motivo}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {new Date(req.dataSolicitacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEdit && req.status !== "REJEITADA" && (
                    <button
                      onClick={() => navigate(`/change-requests/${req.id}`)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${theme === "dark" ? "bg-amber-900/30 text-amber-400 hover:bg-amber-900/50" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                      title="Abrir workspace de simulação"
                    >
                      <GitBranch size={13} />
                      Simular
                    </button>
                  )}
                  <button
                    onClick={() => setReportSap(req)}
                    className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                    title="Relatório de aulas vinculadas"
                  >
                    <FileText size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === req.id ? null : req.id)
                    }
                    className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                    title="Ver detalhes"
                  >
                    <Eye size={16} />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleEdit(req)}
                        className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                        title="Editar"
                      >
                        <FileEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(req)}
                        className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-slate-400 hover:text-red-400 hover:bg-red-900/20" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`}
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedId === req.id && (
                <div
                  className={`px-4 pb-4 pt-0 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}
                >
                  <p
                    className={`text-sm mt-3 leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                  >
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide block mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Descrição
                    </span>
                    {req.descricao || (
                      <em className="opacity-50">Sem descrição</em>
                    )}
                  </p>
                  {req.eventIds.length > 0 && (
                    <div className="mt-3">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Aulas Vinculadas ({req.eventIds.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {req.eventIds.slice(0, 20).map((id) => (
                          <span
                            key={id}
                            className={`text-[10px] px-2 py-0.5 rounded border font-mono ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                          >
                            {id.slice(-8)}
                          </span>
                        ))}
                        {req.eventIds.length > 20 && (
                          <span
                            className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                          >
                            +{req.eventIds.length - 20} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <ChangeRequestModal
          onClose={handleCloseModal}
          editingRequest={editingRequest}
        />
      )}

      {reportSap && (
        <SAPReportModal sap={reportSap} onClose={() => setReportSap(null)} />
      )}
    </div>
  );
};
