import { useState, useEffect } from "react";
import { X, Save, FileEdit } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { getNextSapNumber } from "../services/supabaseService";
import type { ScheduleChangeRequest, ChangeRequestStatus } from "../types";

interface ChangeRequestModalProps {
  onClose: () => void;
  editingRequest?: ScheduleChangeRequest | null;
}

const STATUS_OPTIONS: {
  value: ChangeRequestStatus;
  label: string;
  color: string;
}[] = [
  { value: "PENDENTE", label: "Pendente", color: "bg-amber-500" },
  { value: "APROVADA", label: "Aprovada", color: "bg-green-500" },
  { value: "REJEITADA", label: "Rejeitada", color: "bg-red-500" },
  { value: "EXECUTADA", label: "Executada", color: "bg-blue-500" },
];

export const ChangeRequestModal = ({
  onClose,
  editingRequest,
}: ChangeRequestModalProps) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addChangeRequest, updateChangeRequest, changeRequests } =
    useCourseStore();

  const [form, setForm] = useState({
    numeroAlteracao: "",
    solicitante: "",
    motivo: "",
    descricao: "",
    status: "PENDENTE" as ChangeRequestStatus,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [longSaveWarning, setLongSaveWarning] = useState(false);

  useEffect(() => {
    if (editingRequest) {
      setForm({
        numeroAlteracao: editingRequest.numeroAlteracao,
        solicitante: editingRequest.solicitante,
        motivo: editingRequest.motivo,
        descricao: editingRequest.descricao,
        status: editingRequest.status,
      });
    }
  }, [editingRequest]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (saving) {
      timer = setTimeout(() => {
        setLongSaveWarning(true);
      }, 5000);
    } else {
      setLongSaveWarning(false);
    }
    return () => clearTimeout(timer);
  }, [saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveError(null);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error("Timeout: O servidor não respondeu a tempo (10s).")),
        10000,
      ),
    );

    try {
      const saveAction = async () => {
        if (editingRequest) {
          await updateChangeRequest(editingRequest.id, { ...form }, user.id);
        } else {
          // Passamos a lista local para evitar dependência circular no serviço
          const autoNumber = await getNextSapNumber(
            new Date().getFullYear(),
            changeRequests,
          );
          const newRequest: ScheduleChangeRequest = {
            id: crypto.randomUUID(),
            ...form,
            numeroAlteracao: autoNumber,
            dataSolicitacao: new Date().toISOString(),
            eventIds: [],
            createdAt: new Date().toISOString(),
            createdBy: user.id,
          };
          await addChangeRequest(newRequest, user.id);
        }
      };

      // Corrida contra o timeout de 10 segundos
      await Promise.race([saveAction(), timeoutPromise]);
      onClose();
    } catch (error: any) {
      console.error("❌ Erro ao salvar SAP:", error);
      let msg = error.message || "Erro de conexão com o banco";
      if (msg.includes("Timeout")) {
        msg =
          "Tempo esgotado (10s). Por favor, recarregue a página (F5) para estabilizar a conexão com o banco e tente novamente.";
      }
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
    theme === "dark"
      ? "bg-slate-700 border-slate-600 text-slate-100"
      : "bg-white border-slate-300 text-slate-900"
  }`;
  const labelClass = `block text-sm font-medium mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${theme === "dark" ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-slate-50/50"}`}
        >
          <div className="flex items-center gap-2">
            <FileEdit
              size={18}
              className={theme === "dark" ? "text-amber-400" : "text-amber-600"}
            />
            <h2
              className={`text-lg font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
            >
              {editingRequest ? "Editar SAP" : "Nova Solicitação de Alteração"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-full transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Número da SAP</label>
              <input
                type="text"
                disabled
                placeholder="SAP 001/26"
                value={
                  form.numeroAlteracao || (editingRequest ? "" : "Automático")
                }
                className={inputClass + " opacity-70 cursor-not-allowed"}
              />
            </div>
            <div>
              <label className={labelClass}>Solicitante *</label>
              <input
                type="text"
                required
                placeholder="Nome do solicitante"
                value={form.solicitante}
                onChange={(e) =>
                  setForm((p) => ({ ...p, solicitante: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Motivo *</label>
            <input
              type="text"
              required
              placeholder="Motivo resumido da alteração"
              value={form.motivo}
              onChange={(e) =>
                setForm((p) => ({ ...p, motivo: e.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Descrição Detalhada</label>
            <textarea
              rows={4}
              placeholder="Detalhes sobre a alteração solicitada..."
              value={form.descricao}
              onChange={(e) =>
                setForm((p) => ({ ...p, descricao: e.target.value }))
              }
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    form.status === opt.value
                      ? `${opt.color} text-white border-transparent shadow-sm`
                      : theme === "dark"
                        ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(longSaveWarning || saveError) && (
            <div className="space-y-2">
              {longSaveWarning && !saveError && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs animate-pulse">
                  O salvamento está demorando mais que o esperado. Por favor,
                  aguarde ou verifique sua conexão.
                </div>
              )}
              {saveError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                  {saveError}
                </div>
              )}
            </div>
          )}

          <div
            className={`pt-4 flex justify-end gap-3 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Salvando..." : editingRequest ? "Salvar" : "Criar SAP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
