import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ScheduleChangeRequest } from "../types";

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TYPE_LABELS_PT: Record<string, string> = {
  ACADEMIC: "Acadêmico", EVALUATION: "Avaliação", DAY_OFF: "Day Off",
  COMMEMORATIVE: "Comemorativo", SPORTS: "CDEF", INFORMATIVE: "Informativo",
  HOLIDAY: "Feriado", MILITARY: "Militar", FLIGHT_INSTRUCTION: "Instrução de Voo", TRIP: "Viagem",
};

const TYPE_COLORS_RGB: Record<string, [number, number, number]> = {
  ACADEMIC: [67, 56, 202], EVALUATION: [194, 65, 12], DAY_OFF: [185, 28, 28],
  COMMEMORATIVE: [180, 83, 9], SPORTS: [15, 118, 110], INFORMATIVE: [3, 105, 161],
  HOLIDAY: [190, 18, 60], MILITARY: [21, 128, 61], FLIGHT_INSTRUCTION: [29, 78, 216], TRIP: [109, 40, 217],
};

function fmtDatePT(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Deriva audiência legível a partir de classIds + squadron (mesmo padrão da UI) */
function resolveAudience(classIds: string[], squadron: number | null): string {
  if (squadron === null) return "Todos";
  const ids = [...classIds].sort();
  if (ids.length === 0) return squadron ? `${squadron}º Esq` : "Todos";
  const sqPfx = `${squadron}º `;
  if (ids.every(c => c.endsWith("ESQ")))        return `${sqPfx}Esq`;
  if (ids.every(c => c.endsWith("AVIATION")))   return `${sqPfx}Aviação`;
  if (ids.every(c => c.endsWith("INTENDANCY"))) return `${sqPfx}Intendência`;
  if (ids.every(c => c.endsWith("INFANTRY")))   return `${sqPfx}Infantaria`;
  const letters = [...new Set(ids.map(c => c.slice(1)))].sort();
  if (letters.length >= 4 && letters.every(l => ["A","B","C","D"].includes(l))) return `${sqPfx}Aviação`;
  if (letters.every(l => l === "E")) return `${sqPfx}Intendência`;
  if (letters.every(l => l === "F")) return `${sqPfx}Infantaria`;
  return `${sqPfx}Esq`;
}

/** Exporta o Gantt de Eventos completo do ano para PDF landscape */
export const exportGanttEventsToPDF = (
  ganttEvents: Array<{
    label: string;
    type: string;
    start: Date;
    end: Date;
    squadron: number | null;
    classIds: string[];
  }>,
  year: number,
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`AFA Plan — Gantt de Eventos ${year}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
  doc.text(`Total de eventos: ${ganttEvents.length}`, pageW - 14, 22, { align: "right" });

  const NCOLS = 6;
  const monthCell = (label: string) =>
    ({ content: label, styles: { fillColor: [30,41,59] as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: "bold" as const } });
  const emptyCell = () => monthCell("");

  const rows: unknown[][] = [];
  const byMonth: Record<number, typeof ganttEvents> = {};
  for (const ev of ganttEvents) {
    const m = ev.start.getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(ev);
  }

  for (let m = 0; m < 12; m++) {
    const monthEvs = byMonth[m];
    if (!monthEvs?.length) continue;
    rows.push([monthCell(MONTHS_PT[m].toUpperCase()), ...Array(NCOLS - 1).fill(null).map(emptyCell)]);
    for (const ev of monthEvs) {
      const isoStart = `${ev.start.getFullYear()}-${String(ev.start.getMonth()+1).padStart(2,"0")}-${String(ev.start.getDate()).padStart(2,"0")}`;
      const isoEnd   = `${ev.end.getFullYear()}-${String(ev.end.getMonth()+1).padStart(2,"0")}-${String(ev.end.getDate()).padStart(2,"0")}`;
      const dias = Math.round((ev.end.getTime() - ev.start.getTime()) / 86400000) + 1;
      rows.push([
        TYPE_LABELS_PT[ev.type] ?? ev.type,
        ev.label,
        fmtDatePT(isoStart),
        isoStart === isoEnd ? "—" : fmtDatePT(isoEnd),
        dias === 1 ? "1 dia" : `${dias} dias`,
        resolveAudience(ev.classIds, ev.squadron),
      ]);
    }
  }

  autoTable(doc, {
    startY: 27,
    head: [["Tipo", "Evento", "Início", "Fim", "Duração", "Destinatário"]],
    body: rows as string[][],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18 },
      5: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const type = data.cell.raw as string;
        const key = Object.keys(TYPE_LABELS_PT).find(k => TYPE_LABELS_PT[k] === type);
        if (key) {
          const [r, g, b] = TYPE_COLORS_RGB[key] ?? [100, 100, 100];
          data.cell.styles.fillColor = [r, g, b] as [number,number,number];
          data.cell.styles.textColor = [255, 255, 255] as [number,number,number];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  doc.save(`AFA_GanttEventos_${year}.pdf`);
};

/** Exporta o Calendário Acadêmico (bloqueios) completo do ano para PDF */
export const exportAcademicCalendarToPDF = (
  groups: Array<{
    location: string;
    description?: string;
    startDate: string;
    endDate: string;
    isBlocking: boolean;
    targetSquadron: number | "ALL";
    targetCourse: string;
    targetClass: string;
    color?: string;
  }>,
  year: number,
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`AFA Plan — Calendário Acadêmico ${year}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
  doc.text(`Total de eventos: ${groups.length}`, pageW - 14, 22, { align: "right" });

  const byMonth: Record<number, typeof groups> = {};
  for (const g of groups) {
    const m = parseInt(g.startDate.split("-")[1]) - 1;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(g);
  }

  const rows: string[][] = [];
  for (let m = 0; m < 12; m++) {
    const evs = byMonth[m];
    if (!evs?.length) continue;
    rows.push([`── ${MONTHS_PT[m].toUpperCase()} ──`, "", "", "", ""]);
    for (const g of evs) {
      const isSameDay = g.startDate === g.endDate;
      const periodo = isSameDay ? fmtDatePT(g.startDate) : `${fmtDatePT(g.startDate)} a ${fmtDatePT(g.endDate)}`;
      let destino = "Todos";
      if (g.targetSquadron !== "ALL") {
        const course = g.targetCourse !== "ALL"
          ? ({ AVIATION: "Aviação", INTENDANCY: "Intendência", INFANTRY: "Infantaria" }[g.targetCourse] ?? g.targetCourse)
          : "Esq";
        destino = `${g.targetSquadron}º ${course}`;
      }
      rows.push([
        g.location,
        g.description || "—",
        periodo,
        g.isBlocking ? "Sim" : "Não",
        destino,
      ]);
    }
  }

  autoTable(doc, {
    startY: 27,
    head: [["Evento", "Descrição", "Período", "Bloqueante", "Destinatário"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 38 },
      3: { cellWidth: 20 },
      4: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data.section === "body" && (data.row.raw as any)[0]?.toString().startsWith("── ")) {
        data.cell.styles.fillColor = [30, 41, 59] as [number,number,number];
        data.cell.styles.textColor = [255, 255, 255] as [number,number,number];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7;
      }
    },
  });

  doc.save(`AFA_CalendarioAcademico_${year}.pdf`);
};

export const exportSAPsToExcel = (requests: ScheduleChangeRequest[]) => {
  const data = requests.map((r) => ({
    "Número SAP": r.numeroAlteracao,
    Status: r.status,
    Solicitante: r.solicitante,
    Motivo: r.motivo,
    Descrição: r.descricao,
    "Data Solicitação": new Date(r.dataSolicitacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    "Aulas Vinculadas": r.eventIds.length,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SAPs");
  XLSX.writeFile(
    workbook,
    `AFA_SAP_Export_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
};

export const exportSAPsToPDF = (requests: ScheduleChangeRequest[]) => {
  const doc = new jsPDF();
  const title = "Relatório de Solicitações de Alteração de Programação (SAP)";

  doc.setFontSize(14);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  const tableData = requests.map((r) => [
    r.numeroAlteracao,
    r.status,
    r.solicitante,
    r.motivo.slice(0, 30) + (r.motivo.length > 30 ? "..." : ""),
    new Date(r.dataSolicitacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  ]);

  autoTable(doc, {
    startY: 35,
    head: [["Número", "Status", "Solicitante", "Motivo", "Data"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [180, 83, 9] }, // Amber 700ish
  });

  doc.save(`AFA_SAP_Relatorio_${new Date().toISOString().split("T")[0]}.pdf`);
};

export const exportScheduleToExcel = (
  events: any[],
  disciplines: any[],
  fileName: string,
) => {
  const data = events
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
    .map((e) => {
      const discipline = disciplines.find((d) => d.id === e.disciplineId);
      const isAcademic = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";

      return {
        Data: new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        Horário: `${e.startTime} - ${e.endTime}`,
        Disciplina: isAcademic
          ? "ATIVIDADE ACADÊMICA"
          : discipline?.name || e.disciplineId,
        Turma: e.classId,
        Local: e.location || discipline?.location || "-",
        Instrutor: e.instructorTrigram || "-",
      };
    });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Programação");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportScheduleToPDF = (
  events: any[],
  disciplines: any[],
  fileName: string,
  subtitle: string,
) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("AFA Plan - Programação de Cursos", 14, 15);
  doc.setFontSize(10);
  doc.text(subtitle, 14, 22);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 27);

  const tableData = events
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
    .map((e) => {
      const discipline = disciplines.find((d) => d.id === e.disciplineId);
      const isAcademic = e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC";

      return [
        new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        `${e.startTime}-${e.endTime}`,
        isAcademic
          ? "ACADÊMICO"
          : discipline?.name?.slice(0, 40) || e.disciplineId,
        e.classId,
        e.location || discipline?.location || "-",
      ];
    });

  autoTable(doc, {
    startY: 32,
    head: [["Data", "Horário", "Disciplina/Atividade", "Turma", "Local"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [30, 64, 175] }, // Blue 800
    styles: { fontSize: 8 },
  });

  doc.save(`${fileName}.pdf`);
};
