import { useEffect, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { supabase } from "../config/supabase";
import { normalizeEvent } from "../services/supabaseService";
import type { ScheduleChangeRequest, ScheduleEvent } from "../types";

interface Props {
  sap: ScheduleChangeRequest;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  EXECUTADA: "Executada",
};

export const SAPReportModal = ({ sap, onClose }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { disciplines, instructors, cohorts } = useCourseStore();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sap.eventIds.length) { setLoading(false); return; }
    supabase
      .from("programacao_aulas")
      .select("*")
      .in("id", sap.eventIds)
      .then(({ data }) => {
        setEvents((data ?? []).map(normalizeEvent) as unknown as ScheduleEvent[]);
        setLoading(false);
      });
  }, [sap.id]);

  const sorted = [...events].sort((a, b) => {
    const d = (a.date ?? "").localeCompare(b.date ?? "");
    if (d !== 0) return d;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    const rows = sorted.map((ev) => {
      const disc = disciplines.find((d) => d.id === ev.disciplineId);
      const cohort = cohorts.find((c) => String(c.id) === ev.classId);
      const turma = cohort?.name ?? ev.classId ?? "—";
      const trigram = ev.instructorTrigram || disc?.instructorTrigram || "";
      const inst = trigram ? instructors.find((i) => i.trigram === trigram) : null;
      const instructor = inst?.warName || trigram || "—";
      const date = ev.date
        ? new Date(ev.date + "T12:00:00").toLocaleDateString("pt-BR")
        : "—";
      return `
        <tr>
          <td>${disc?.code || ev.disciplineId || "—"}</td>
          <td>${disc?.name || "—"}</td>
          <td>${turma}</td>
          <td>${date}</td>
          <td>${ev.startTime ?? "—"} – ${ev.endTime ?? "—"}</td>
          <td>${instructor}</td>
          <td>${ev.location || disc?.location || "—"}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório ${sap.numeroAlteracao}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    h1 { font-size: 16px; margin-bottom: 2px; }
    .subtitle { color: #555; font-size: 11px; margin-bottom: 16px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 16px; border: 1px solid #ddd; padding: 10px; border-radius: 6px; background: #f9f9f9; }
    .meta-grid dt { font-weight: bold; color: #444; font-size: 10px; text-transform: uppercase; }
    .meta-grid dd { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) td { background: #f3f4f6; }
    .footer { margin-top: 16px; font-size: 9px; color: #999; text-align: right; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>${sap.numeroAlteracao}</h1>
  <p class="subtitle">Solicitação de Alteração da Programação — gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  <dl class="meta-grid">
    <dt>Status</dt><dd>${STATUS_LABELS[sap.status] ?? sap.status}</dd>
    <dt>Solicitante</dt><dd>${sap.solicitante}</dd>
    <dt>Motivo</dt><dd>${sap.motivo}</dd>
    <dt>Data</dt><dd>${new Date(sap.dataSolicitacao).toLocaleDateString("pt-BR")}</dd>
    ${sap.descricao ? `<dt style="grid-column:1/3">Descrição</dt><dd style="grid-column:1/3">${sap.descricao}</dd>` : ""}
  </dl>
  <table>
    <thead>
      <tr>
        <th>Cód.</th><th>Disciplina</th><th>Turma</th><th>Data</th><th>Horário</th><th>Instrutor</th><th>Local</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#999">Nenhuma aula vinculada</td></tr>`}</tbody>
  </table>
  <p class="footer">Total: ${sorted.length} aula(s) vinculada(s)</p>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const bg = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const text = isDark ? "text-slate-100" : "text-slate-800";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-100";
  const rowBg = (i: number) => isDark
    ? (i % 2 === 0 ? "bg-slate-700/30" : "")
    : (i % 2 === 0 ? "bg-slate-50" : "");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border ${bg}`}>

        {/* Header */}
        <div className={`px-6 py-4 border-b ${border} flex items-center justify-between flex-shrink-0`}>
          <div>
            <h2 className={`text-lg font-bold ${text}`}>{sap.numeroAlteracao}</h2>
            <p className={`text-xs ${muted}`}>Relatório de Aulas Vinculadas</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Printer size={14} />
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SAP meta */}
        <div className={`px-6 py-3 border-b ${border} grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0`}>
          {[
            { label: "Status", value: STATUS_LABELS[sap.status] ?? sap.status },
            { label: "Solicitante", value: sap.solicitante },
            { label: "Motivo", value: sap.motivo },
            { label: "Data", value: new Date(sap.dataSolicitacao).toLocaleDateString("pt-BR") },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
              <p className={`text-xs font-medium ${text}`}>{value}</p>
            </div>
          ))}
          {sap.descricao && (
            <div className="col-span-2 md:col-span-4">
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Descrição</p>
              <p className={`text-xs ${text}`}>{sap.descricao}</p>
            </div>
          )}
        </div>

        {/* Events table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : sorted.length === 0 ? (
            <div className={`text-center py-12 text-sm ${muted}`}>Nenhuma aula vinculada a esta SAP.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-700 text-white text-left">
                  {["Cód.", "Disciplina", "Turma", "Data", "Horário", "Instrutor", "Local"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((ev, i) => {
                  const disc = disciplines.find((d) => d.id === ev.disciplineId);
                  const cohort = cohorts.find((c) => String(c.id) === ev.classId);
                  const turma = cohort?.name ?? ev.classId ?? "—";
                  const trigram = ev.instructorTrigram || disc?.instructorTrigram || "";
                  const inst = trigram ? instructors.find((ins) => ins.trigram === trigram) : null;
                  const instructor = inst?.warName || trigram || "—";
                  const date = ev.date
                    ? new Date(ev.date + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—";
                  return (
                    <tr key={ev.id} className={rowBg(i)}>
                      <td className={`px-3 py-1.5 font-bold ${text}`}>{disc?.code || ev.disciplineId || "—"}</td>
                      <td className={`px-3 py-1.5 ${text}`}>{disc?.name || "—"}</td>
                      <td className={`px-3 py-1.5 ${muted}`}>{turma}</td>
                      <td className={`px-3 py-1.5 ${muted} whitespace-nowrap`}>{date}</td>
                      <td className={`px-3 py-1.5 ${muted} whitespace-nowrap`}>{ev.startTime ?? "—"} – {ev.endTime ?? "—"}</td>
                      <td className={`px-3 py-1.5 ${muted}`}>{instructor}</td>
                      <td className={`px-3 py-1.5 ${muted}`}>{ev.location || disc?.location || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {!loading && sorted.length > 0 && (
          <div className={`px-6 py-2 border-t ${border} flex-shrink-0`}>
            <p className={`text-xs ${muted}`}>{sorted.length} aula(s) vinculada(s)</p>
          </div>
        )}
      </div>
    </div>
  );
};
