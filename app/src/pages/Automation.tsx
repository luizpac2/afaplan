import { useState, useMemo, useEffect } from "react";
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  Calendar,
  XCircle,
  Trash2,
} from "lucide-react";
import { useCourseStore } from "../store/useCourseStore";
import { useTheme } from "../contexts/ThemeContext";
import {
  autoScheduleDiscipline,
  type SchedulingResult,
} from "../utils/schedulingEngine";
import { createDateFromISO } from "../utils/dateUtils";
import type { CourseYear, ScheduleEvent } from "../types";
import { parseCsvToEvents } from "../utils/csvImporter";

export const Automation = () => {
  const {
    disciplines,
    cohorts,
    classes,
    addEvent,
    semesterConfigs,
    fetchYearlyEvents,
  } = useCourseStore();
  const { theme } = useTheme();
  const [selectedSquadron, setSelectedSquadron] = useState<CourseYear | "">("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split("T")[0];
  });
  const [result, setResult] = useState<SchedulingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [existingEvents, setExistingEvents] = useState<ScheduleEvent[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importSquadron, setImportSquadron] = useState<CourseYear>(1);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const year = new Date(startDate).getFullYear();
    fetchYearlyEvents(year).then((data) => {
      setExistingEvents(data);
    });
  }, [startDate, fetchYearlyEvents]);

  const currentYear = new Date().getFullYear();

  // Get course type for selected class
  const selectedClassData = useMemo(() => {
    if (!selectedSquadron || !selectedClass || selectedClass === "ESQ")
      return null;
    const classId = `${selectedSquadron}${selectedClass}`;
    return classes.find((c) => c.id === classId);
  }, [selectedSquadron, selectedClass, classes]);

  // Filter disciplines based on squadron (year) and class course type
  const availableDisciplines = useMemo(() => {
    if (!selectedSquadron) return [];

    const squadronYear = selectedSquadron as CourseYear;
    let filtered = disciplines.filter(
      (d) => d.year === squadronYear || d.year === "ALL",
    );

    // If specific class selected (not ESQ), filter by course type
    if (selectedClassData) {
      const courseType = selectedClassData.type;
      filtered = filtered.filter(
        (d) =>
          d.course === courseType ||
          d.course === "ALL" ||
          d.category === "COMMON",
      );
    } else if (selectedClass === "ESQ") {
      // "All classes" selected: Only show COMMON disciplines
      filtered = filtered.filter(
        (d) => d.course === "ALL" || d.category === "COMMON",
      );
    }

    return filtered.sort((a, b) => {
      const nameComp = a.name.localeCompare(b.name, "pt-BR");
      if (nameComp !== 0) return nameComp;
      // Fallback to year if names are identical
      const yearA = a.year === "ALL" ? 0 : a.year || 0;
      const yearB = b.year === "ALL" ? 0 : b.year || 0;
      return yearA - yearB;
    });
  }, [selectedSquadron, selectedClassData, disciplines]);

  const handleExecute = () => {
    if (!selectedDiscipline || !selectedSquadron || !selectedClass) {
      setResult({
        success: false,
        errors: ["Selecione esquadrão, turma e disciplina"],
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    // Small delay to show processing state
    setTimeout(() => {
      const discipline = disciplines.find((d) => d.id === selectedDiscipline);
      if (!discipline) {
        setResult({
          success: false,
          errors: ["Disciplina não encontrada"],
        });
        setIsProcessing(false);
        return;
      }

      const schedulingResult = autoScheduleDiscipline(
        {
          disciplineId: selectedDiscipline,
          squadron: selectedSquadron as CourseYear,
          classLetter: selectedClass,
          startDate: createDateFromISO(startDate),
          endDate: createDateFromISO(endDate),
        },
        discipline,
        existingEvents,
        semesterConfigs,
      );

      if (schedulingResult.success && schedulingResult.events) {
        // Add events to store
        schedulingResult.events.forEach((event) => addEvent(event));
      }

      setResult(schedulingResult);
      setIsProcessing(false);
    }, 500);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;

    setIsProcessing(true);
    setResult(null);
    setImportProgress(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setResult({ success: false, errors: ["Falha ao ler o arquivo CSV"] });
        setIsProcessing(false);
        return;
      }

      try {
        const parsedEvents = parseCsvToEvents(
          content,
          disciplines,
          importSquadron,
        );

        if (parsedEvents.length === 0) {
          setResult({
            success: false,
            errors: [
              "Nenhum evento válido encontrado no CSV. Verifique se os códigos das disciplinas coincidem.",
            ],
          });
          setIsProcessing(false);
          return;
        }

        // 1. Identify date range in CSV
        const dates = parsedEvents.map((e) => e.date).sort();
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        // 2. Handle substitution if enabled
        if (replaceExisting) {
          const { events: currentEvents, deleteBatchEvents } =
            useCourseStore.getState();
          const eventsToReplace = currentEvents.filter(
            (e) =>
              e.targetSquadron === importSquadron &&
              e.date >= minDate &&
              e.date <= maxDate,
          );

          if (eventsToReplace.length > 0) {
            deleteBatchEvents(eventsToReplace.map((e) => e.id));
            // Small delay to ensure Firestore catches up with deletions before insertions
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        // 3. Batch save to Firestore in chunks
        const BATCH_SIZE = 500;
        let importedCount = 0;

        for (let i = 0; i < parsedEvents.length; i += BATCH_SIZE) {
          const batchItems = parsedEvents.slice(i, i + BATCH_SIZE);
          setImportProgress({ current: i, total: parsedEvents.length });

          const { addBatchEvents } = useCourseStore.getState();
          addBatchEvents(batchItems);

          importedCount += batchItems.length;

          // Small delay to prevent UI freeze and Firebase rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        setResult({
          success: true,
          events: parsedEvents.slice(0, 10), // Show first 10 as sample
          warnings: [
            `Total de ${importedCount} aulas importadas com sucesso para o ${importSquadron}º Esquadrão.`,
          ],
        });

        // Detailed Audit Log
        const { logAction } = await import("../utils/auditLogger");
        logAction({
          action: "IMPORT",
          entity: "CSV",
          entityId: `IMPORT_${new Date().getTime()}`,
          entityName: `Importação: ${csvFile.name}`,
          after: {
            fileName: csvFile.name,
            squadron: importSquadron,
            startDate: minDate,
            endDate: maxDate,
            recordCount: importedCount,
            replacedExisting: replaceExisting,
          },
        });
      } catch (error) {
        console.error("Import error:", error);
        setResult({
          success: false,
          errors: ["Erro durante a importação: " + (error as Error).message],
        });
      } finally {
        setIsProcessing(false);
        setImportProgress(null);
        setCsvFile(null);
      }
    };

    reader.readAsText(csvFile);
  };

  const handleClearSquadronData = async (squadronOverride?: CourseYear) => {
    const targetSquadron = squadronOverride || selectedSquadron;
    if (!targetSquadron) return;

    const year = new Date(startDate).getFullYear();
    const squadronYear = targetSquadron as CourseYear;

    if (
      !window.confirm(
        `TEM CERTEZA? Isso excluirá TODAS as aulas do ${squadronYear}º Esquadrão em ${year}. Esta ação é irreversível!`,
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const allEvents = await fetchYearlyEvents(year);
      const eventsToDelete = allEvents.filter(
        (e) =>
          e.targetSquadron === squadronYear ||
          (e.classId && e.classId.startsWith(squadronYear.toString())),
      );

      if (eventsToDelete.length === 0) {
        setResult({
          success: true,
          warnings: ["Nenhuma aula encontrada para este esquadrão em " + year],
        });
        return;
      }

      const { deleteBatchEvents } = useCourseStore.getState();
      const ids = eventsToDelete.map((e) => e.id);

      // Delete in smaller batches if too large
      const CHUNK_SIZE = 500;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        deleteBatchEvents(chunk);
        setImportProgress({ current: i + chunk.length, total: ids.length });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setResult({
        success: true,
        warnings: [
          `Sucesso: ${ids.length} aulas do ${squadronYear}º Esquadrão foram excluídas.`,
        ],
      });

      // Log action
      const { logAction } = await import("../utils/auditLogger");
      logAction({
        action: "DELETE",
        entity: "SQUADRON_EVENTS",
        entityId: `CLEAN_${squadronYear}_${year}`,
        entityName: `Limpeza Completa ${squadronYear}º Esq - ${year}`,
        after: { squadron: squadronYear, year, count: ids.length },
      });
    } catch (error) {
      console.error("Clear error:", error);
      setResult({
        success: false,
        errors: ["Erro ao limpar dados: " + (error as Error).message],
      });
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSelectedSquadron("");
    setSelectedClass("");
    setSelectedDiscipline("");
  };

  // Get cohort name for squadron
  const getCohortName = (squadron: CourseYear) => {
    const entryYear = currentYear - Number(squadron) + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return cohort ? cohort.name : "";
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1
          className={`text-3xl  tracking-tight flex items-center gap-3 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
        >
          <Zap className="text-blue-600" size={32} />
          Automação de Programação
        </h1>
        <p
          className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
        >
          Alocação automática de aulas baseada na Ficha Informativa
        </p>
      </div>

      <div
        className={`rounded-xl shadow-sm border p-6 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        {/* Form Section */}
        <div className="space-y-4 mb-6">
          {/* Step 1: Squadron Selector */}
          <div>
            <label
              className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
            >
              1. Esquadrão *
            </label>
            <select
              value={selectedSquadron}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSquadron(val ? (Number(val) as CourseYear) : "");
                setSelectedClass(""); // Reset class
                setSelectedDiscipline(""); // Reset discipline
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
            >
              <option value="">Selecione o Esquadrão</option>
              {[1, 2, 3, 4].map((squad) => {
                const cohortName = getCohortName(squad as CourseYear);
                return (
                  <option key={squad} value={squad}>
                    {squad}º Esquadrão {cohortName ? `(${cohortName})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Step 2: Class Selector - Only show after squadron is selected */}
          {selectedSquadron && (
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
              >
                2. Turma *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedDiscipline(""); // Reset discipline when class changes
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
              >
                <option value="">Selecione a Turma</option>
                <option value="ESQ">
                  Todas as Turmas do {selectedSquadron}º Esquadrão
                </option>
                {["A", "B", "C", "D", "E", "F"].map((letter) => (
                  <option key={letter} value={letter}>
                    Turma {letter}
                  </option>
                ))}
              </select>
              {selectedClassData && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedClassData.type === "AVIATION" &&
                    "✈️ Aviação (CFOAV)"}
                  {selectedClassData.type === "INTENDANCY" &&
                    "📊 Intendência (CFOINT)"}
                  {selectedClassData.type === "INFANTRY" &&
                    "🎖️ Infantaria (CFOINF)"}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Discipline Selector - Only show after class is selected */}
          {selectedClass && (
            <div>
              <label
                className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
              >
                3. Disciplina *
                {availableDisciplines.length > 0 && (
                  <span
                    className={`ml-2 text-xs font-normal ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                  >
                    ({availableDisciplines.length} disciplina
                    {availableDisciplines.length !== 1 ? "s" : ""} disponível)
                  </span>
                )}
              </label>
              <select
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
              >
                <option value="">Selecione a disciplina</option>
                {availableDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name} ({d.load_hours}h)
                  </option>
                ))}
              </select>
              {availableDisciplines.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ Nenhuma disciplina disponível para este esquadrão/turma
                </p>
              )}
            </div>
          )}

          {/* Date Range */}
          {selectedDiscipline && (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
            >
              <div>
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                >
                  Data Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                >
                  Data Fim
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>
            </div>
          )}

          {/* Execute Button */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleExecute}
              disabled={
                isProcessing ||
                !selectedDiscipline ||
                !selectedSquadron ||
                !selectedClass
              }
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-bold shadow-sm"
            >
              {isProcessing && !selectedDiscipline ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Executar Automação
                </>
              )}
            </button>

            {selectedSquadron && !selectedDiscipline && (
              <button
                onClick={() => handleClearSquadronData()}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors font-bold shadow-sm"
              >
                <Trash2 size={18} />
                Limpar Dados do Ano ({new Date(startDate).getFullYear()})
              </button>
            )}

            {result && (
              <button
                onClick={handleReset}
                className={`px-6 py-2.5 rounded-lg transition-colors font-bold ${theme === "dark" ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Nova Operação
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div
            className={`border-t pt-6 mt-6 ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
          >
            <h3
              className={`text-lg  mb-4 flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
            >
              {result.success ? (
                <>
                  <CheckCircle
                    className={`${theme === "dark" ? "text-green-400" : "text-green-600"}`}
                    size={24}
                  />
                  Automação Concluída
                </>
              ) : (
                <>
                  <XCircle
                    className={`${theme === "dark" ? "text-red-400" : "text-red-600"}`}
                    size={24}
                  />
                  Automação Falhou
                </>
              )}
            </h3>

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div
                className={`mb-4 p-4 border rounded-lg ${theme === "dark" ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`flex-shrink-0 mt-0.5 ${theme === "dark" ? "text-red-400" : "text-red-600"}`}
                    size={20}
                  />
                  <div className="flex-1">
                    <h4
                      className={` mb-2 ${theme === "dark" ? "text-red-200" : "text-red-900"}`}
                    >
                      Erros Encontrados
                    </h4>
                    <ul
                      className={`list-disc list-inside space-y-1 text-sm ${theme === "dark" ? "text-red-300" : "text-red-800"}`}
                    >
                      {result.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div
                className={`mb-4 p-4 border rounded-lg ${theme === "dark" ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`flex-shrink-0 mt-0.5 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`}
                    size={20}
                  />
                  <div className="flex-1">
                    <h4
                      className={` mb-2 ${theme === "dark" ? "text-amber-200" : "text-amber-900"}`}
                    >
                      Avisos
                    </h4>
                    <ul
                      className={`list-disc list-inside space-y-1 text-sm ${theme === "dark" ? "text-amber-300" : "text-amber-800"}`}
                    >
                      {result.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Success - Events Created */}
            {result.success && result.events && result.events.length > 0 && (
              <div
                className={`p-4 border rounded-lg ${theme === "dark" ? "bg-green-900/20 border-green-800" : "bg-green-50 border-green-200"}`}
              >
                <div className="flex items-start gap-2 mb-3">
                  <CheckCircle
                    className={`flex-shrink-0 mt-0.5 ${theme === "dark" ? "text-green-400" : "text-green-600"}`}
                    size={20}
                  />
                  <div className="flex-1">
                    <h4
                      className={` mb-1 ${theme === "dark" ? "text-green-200" : "text-green-900"}`}
                    >
                      {result.events.length} Aulas Alocadas com Sucesso
                    </h4>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-green-300" : "text-green-700"}`}
                    >
                      As aulas foram adicionadas à programação. Verifique em
                      Programação.
                    </p>
                  </div>
                </div>

                {/* Event Summary */}
                <div className="mt-3 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead
                      className={`sticky top-0 ${theme === "dark" ? "bg-green-900/40 text-green-200" : "bg-green-100 text-green-900"}`}
                    >
                      <tr>
                        <th className="text-left p-2 ">Data</th>
                        <th className="text-left p-2 ">Horário</th>
                        <th className="text-left p-2 ">Turma</th>
                        <th className="text-left p-2 ">Local</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${theme === "dark" ? "divide-green-800" : "divide-green-100"}`}
                    >
                      {result.events.map((event, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors ${theme === "dark" ? "hover:bg-green-900/30 text-green-300" : "hover:bg-green-100/50 text-green-800"}`}
                        >
                          <td className="p-2">
                            {createDateFromISO(event.date).toLocaleDateString(
                              "pt-BR",
                              {
                                weekday: "short",
                                day: "2-digit",
                                month: "2-digit",
                              },
                            )}
                          </td>
                          <td className="p-2">
                            {event.startTime} - {event.endTime}
                          </td>
                          <td className="p-2 ">{event.classId}</td>
                          <td
                            className={
                              theme === "dark"
                                ? "text-green-400"
                                : "text-green-700"
                            }
                          >
                            {event.location}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CSV Import Section */}
        {!result && !isProcessing && (
          <div
            className={`mt-8 pt-8 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
          >
            <h2
              className={`text-xl  mb-4 flex items-center gap-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
            >
              <Calendar className="text-green-600" size={24} />
              Importação de Dados Externos (CSV)
            </h2>
            <div className="space-y-4">
              <p
                className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
              >
                Importe a programação completa de qualquer esquadrão a partir de
                um arquivo CSV. O arquivo deve conter colunas:{" "}
                <strong>Data, Turma, Tempo, Materia</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label
                    className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    1. Escolha o Esquadrão Destino
                  </label>
                  <select
                    value={importSquadron}
                    onChange={(e) =>
                      setImportSquadron(Number(e.target.value) as CourseYear)
                    }
                    className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all mb-4 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                  >
                    {[1, 2, 3, 4].map((squad) => {
                      const cohortName = getCohortName(squad as CourseYear);
                      return (
                        <option key={squad} value={squad}>
                          {squad}º Esquadrão{" "}
                          {cohortName ? `(${cohortName})` : ""}
                        </option>
                      );
                    })}
                  </select>

                  <label
                    className={`block text-sm  mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    2. Selecione o Arquivo CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300"}`}
                  />
                </div>
                <div className="flex-1 w-full flex items-center gap-2 pb-1.5">
                  <input
                    type="checkbox"
                    id="replaceExisting"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="replaceExisting"
                    className={`text-sm  font-medium ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    Substituir programação existente no período
                  </label>
                </div>
                <button
                  onClick={handleCsvImport}
                  disabled={!csvFile || isProcessing}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
                >
                  Iniciar Importação
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Loader */}
        {isProcessing && importProgress && (
          <div className="mt-6">
            <div className="flex justify-between mb-1 text-sm">
              <span
                className={
                  theme === "dark" ? "text-slate-300" : "text-slate-700"
                }
              >
                Importando aulas...
              </span>
              <span className="font-bold">
                {Math.round(
                  (importProgress.current / importProgress.total) * 100,
                )}
                %
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Processando {importProgress.current} de {importProgress.total}{" "}
              registros. Por favor, não feche esta janela.
            </p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div
        className={`mt-6 p-4 border rounded-lg ${theme === "dark" ? "bg-blue-900/20 border-blue-800 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"}`}
      >
        <div className="flex items-start gap-2">
          <Calendar
            className={`flex-shrink-0 mt-0.5 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
            size={20}
          />
          <div className="text-sm">
            <p className=" mb-1">Como funciona a automação:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Valida a Ficha Informativa da disciplina (carga horária, dias
                permitidos)
              </li>
              <li>
                Calcula número de aulas necessárias baseado na carga horária
              </li>
              <li>
                Busca horários disponíveis respeitando dias da semana permitidos
              </li>
              <li>
                Distribui aulas uniformemente evitando sobrecarga em um único
                dia
              </li>
              <li>Detecta e reporta conflitos antes de alocar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
