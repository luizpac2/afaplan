import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCourseStore } from "../store/useCourseStore";
import {
  Calendar,
  MapPin,
  Printer,
  ArrowLeft,
  BookOpen,
  Clock,
} from "lucide-react";
import { formatDate } from "../utils/dateUtils";
import { Badge } from "../components/common/Badge";
import type { ScheduleEvent, Discipline } from "../types";

export const DisciplineReport = () => {
  const { disciplineId } = useParams<{ disciplineId: string }>();
  const navigate = useNavigate();
  const { disciplines, fetchYearlyEvents } = useCourseStore();
  const [disciplineEvents, setDisciplineEvents] = useState<ScheduleEvent[]>([]);

  const discipline = useMemo(
    () => disciplines.find((d: Discipline) => d.id === disciplineId),
    [disciplines, disciplineId],
  );

  useEffect(() => {
    if (!disciplineId || !discipline) return;

    // Fallback pra verificação segura de ano da disciplina
    const targetYear = new Date().getFullYear();

    fetchYearlyEvents(targetYear).then((allEvents) => {
      const discEvents = allEvents.filter(
        (e) => e.disciplineId === disciplineId,
      );
      const sorted = discEvents.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      setDisciplineEvents(sorted);
    });
  }, [disciplineId, discipline, fetchYearlyEvents]);

  const totalHours = disciplineEvents.length; // Assuming 1 event = 1 hour/tempo

  if (!discipline) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Disciplina não encontrada.</p>
        <button
          onClick={() => navigate("/disciplinas")}
          className="mt-4 text-blue-600 hover:underline flex items-center gap-2 justify-center mx-auto"
        >
          <ArrowLeft size={16} /> Voltar para Disciplinas
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-report, #printable-report * {
                        visibility: visible;
                    }
                    #printable-report {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                        padding: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse;
                        margin-top: 20px;
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
            `}</style>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
            title="Voltar"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl  text-slate-900 dark:text-white tracking-tight">
              Relatório de Alocação
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Detalhamento de aulas por disciplina.
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-sm "
        >
          <Printer size={20} />
          Imprimir Relatório
        </button>
      </div>

      <div id="printable-report" className="space-y-6">
        {/* Header Information */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 className="text-xl  text-slate-900 dark:text-white">
                    {discipline.name}
                  </h2>
                  <p className="text-sm font-mono text-slate-500 dark:text-slate-400">
                    {discipline.code}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Clock
                    size={16}
                    className="text-slate-400 dark:text-slate-500"
                  />
                  <span>
                    Carga Prevista: <strong>{(() => {
                        if (discipline.ppcLoads && Object.keys(discipline.ppcLoads).length > 0) {
                            return Math.max(...Object.values(discipline.ppcLoads));
                        }
                        return discipline.load_hours || 0;
                    })()}h</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Calendar
                    size={16}
                    className="text-slate-400 dark:text-slate-500"
                  />
                  <span>
                    Aulas Alocadas: <strong>{totalHours}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 pt-4 md:pt-0 md:pl-6">
              <p className="text-xs  text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Instrutor Responsável
              </p>
              <p className="text-lg  text-slate-800 dark:text-white">
                {discipline.instructor || "Não atribuído"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {discipline.year === "ALL"
                  ? "Todos os Esquadrões"
                  : `${discipline.year}º Esquadrão`}
              </p>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase ">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Horário</th>
                <th className="px-6 py-4">Turma/Esquadrão</th>
                <th className="px-6 py-4">Local</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {disciplineEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic"
                  >
                    Nenhuma aula alocada para esta disciplina até o momento.
                  </td>
                </tr>
              ) : (
                disciplineEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className=" text-slate-700 dark:text-slate-300">
                        {formatDate(new Date(event.date))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {event.startTime} - {event.endTime}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="blue">{event.classId}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin
                          size={14}
                          className="text-slate-400 dark:text-slate-500"
                        />
                        {discipline.location || "a definir"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Relatório gerado pelo AFA Planner em{" "}
          {new Date().toLocaleString("pt-BR")}
        </div>
      </div>
    </div>
  );
};
