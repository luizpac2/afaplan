import { useState } from "react";
import { X, Link2, Plus, Check, FileEdit, Clock } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { ChangeRequestModal } from "./ChangeRequestModal";
import type { ScheduleChangeRequest } from "../types";

interface LinkChangeRequestModalProps {
  selectedEventIds: string[];
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDENTE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  APROVADA:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJEITADA: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  EXECUTADA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export const LinkChangeRequestModal = ({
  selectedEventIds,
  onClose,
}: LinkChangeRequestModalProps) => {
  const { theme } = useTheme();
  const { changeRequests, linkEventsToRequest } = useCourseStore();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [linking, setLinking] = useState(false);

  const activeRequests = changeRequests.filter(
    (r) => r.status !== "REJEITADA" && r.status !== "EXECUTADA",
  );
  const otherRequests = changeRequests.filter(
    (r) => r.status === "REJEITADA" || r.status === "EXECUTADA",
  );

  const handleLink = async () => {
    if (!selectedRequestId) return;
    setLinking(true);
    try {
      const request = changeRequests.find((r) => r.id === selectedRequestId);
      if (!request) return;
      const mergedIds = [
        ...new Set([...request.eventIds, ...selectedEventIds]),
      ];
      await linkEventsToRequest(selectedRequestId, mergedIds);
      onClose();
    } finally {
      setLinking(false);
    }
  };

  const renderRequest = (req: ScheduleChangeRequest) => (
    <div
      key={req.id}
      onClick={() => setSelectedRequestId(req.id)}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        selectedRequestId === req.id
          ? theme === "dark"
            ? "border-amber-500 bg-amber-900/20"
            : "border-amber-500 bg-amber-50"
          : theme === "dark"
            ? "border-slate-700 bg-slate-700/30 hover:bg-slate-700/50"
            : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {selectedRequestId === req.id && (
            <Check size={14} className="text-amber-500" />
          )}
          <span
            className={`text-sm font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
          >
            {req.numeroAlteracao}
          </span>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}
        >
          {req.status}
        </span>
      </div>
      <p
        className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
      >
        <span className="font-medium">Solicitante:</span> {req.solicitante}
      </p>
      <p
        className={`text-xs truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
      >
        {req.motivo}
      </p>
      <div
        className={`flex items-center gap-1 mt-1.5 text-[10px] ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
      >
        <Clock size={10} />
        {new Date(req.dataSolicitacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} •{" "}
        {req.eventIds.length} aulas vinculadas
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div
          className={`rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}
        >
          <div
            className={`px-6 py-4 border-b flex items-center justify-between ${theme === "dark" ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-slate-50/50"}`}
          >
            <div className="flex items-center gap-2">
              <Link2
                size={18}
                className={
                  theme === "dark" ? "text-amber-400" : "text-amber-600"
                }
              />
              <h2
                className={`text-lg font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
              >
                Vincular a uma SAP
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-full transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${theme === "dark" ? "bg-slate-700/50 text-slate-300" : "bg-blue-50 text-blue-700"}`}
            >
              <FileEdit size={14} />
              <span>
                <b>{selectedEventIds.length} aula(s)</b> serão vinculadas à SAP
                selecionada.
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {activeRequests.length > 0 ? (
                activeRequests.map(renderRequest)
              ) : (
                <p
                  className={`text-sm text-center py-4 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                >
                  Nenhuma SAP ativa. Crie uma nova abaixo.
                </p>
              )}
            </div>

            {otherRequests.length > 0 && (
              <details className="text-xs">
                <summary
                  className={`cursor-pointer select-none ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                >
                  Ver SAPs concluídas/rejeitadas ({otherRequests.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {otherRequests.map(renderRequest)}
                </div>
              </details>
            )}

            <div
              className={`pt-4 flex justify-between gap-3 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}
            >
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 border transition-colors ${theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
              >
                <Plus size={14} />
                Nova SAP
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLink}
                  disabled={!selectedRequestId || linking}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Link2 size={14} />
                  {linking ? "Vinculando..." : "Vincular"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <ChangeRequestModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
};
