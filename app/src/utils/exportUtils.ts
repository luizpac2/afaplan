import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ScheduleChangeRequest } from "../types";

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
  doc.text("AFA Planner - Programação de Cursos", 14, 15);
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
