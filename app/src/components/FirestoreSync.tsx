import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import {
  fetchCollectionCached,
  subscribeToCollection,
} from "../services/supabaseService";
import type {
  Discipline,
  CourseClass,
  Cohort,
  SystemNotice,
  VisualConfig,
  Instructor,
  InstructorOccurrence,
  SemesterConfig,
  ScheduleChangeRequest,
} from "../types";

/**
 * FirestoreSync — carrega dados estáticos com fetchCollectionCached (usando persistência local TTL 4h)
 * e mantém onSnapshot APENAS para notices (avisos do sistema, precisam de tempo real).
 *
 * Economia estimada: -90% das leituras diárias do Firestore.
 */
export const FirestoreSync = () => {
  const { user } = useAuth();
  const {
    setDisciplines,
    setClasses,
    setCohorts,
    setNotices,
    setVisualConfigs,
    setInstructors,
    setOccurrences,
    setSemesterConfigs,
    setChangeRequests,
    setDataReady,
  } = useCourseStore();

  useEffect(() => {
    if (!user) return;

    console.log("📥 Carregando dados estáticos (com cache TTL 4h)...");

    // Coleções estáticas: carregadas UMA VEZ ao login ou do localStorage se < 4h
    const loadStaticCollections = async () => {
      try {
        const results = await Promise.allSettled([
          fetchCollectionCached("disciplinas"),
          fetchCollectionCached("turma_secoes"),
          fetchCollectionCached("turmas"),
          fetchCollectionCached("visualConfigs"),
          fetchCollectionCached("instructors"),
          fetchCollectionCached("docente_ocorrencias"),
          fetchCollectionCached("semester_configs"),
          fetchCollectionCached("solicitacoes_sap"),
        ]);

        const [
          disciplines,
          classes,
          cohorts,
          visualConfigs,
          instructors,
          occurrences,
          semesterConfigs,
          changeRequests,
        ] = results;

        if (disciplines.status === "fulfilled") {
          const mapped = (disciplines.value as any[]).map(d => ({
            ...d,
            id: d.id,
            code: d.sigla || d.code || d.id,
            name: d.nome || d.name || "Sem Nome",
            trainingField: d.campo || d.trainingField || "GERAL",
            instructorTrigram: d.docente_id || d.instructorTrigram,
            load_hours: d.carga_horaria || d.load_hours,
          }));
          setDisciplines(mapped as Discipline[]);
        } else console.warn("⚠️ Falha ao carregar disciplinas:", disciplines.reason);

        if (classes.status === "fulfilled") {
          const turmasList = cohorts.status === "fulfilled" ? (cohorts.value as any[]) : [];
          const currentYear = new Date().getFullYear();
          const mapped = (classes.value as any[]).map(c => {
            const turma = turmasList.find((t: any) => t.id === c.turma_id);
            const entryYear = turma?.entryYear || turma?.ano_ingresso;
            const computedYear = entryYear ? Math.min(4, Math.max(1, currentYear - entryYear + 1)) : 1;
            return {
              ...c,
              id: c.id,
              name: c.secao || c.name || turma?.name || "?",
              year: c.year || computedYear,
              type: c.type || c.tipo || "AVIATION",
              studentCount: c.qtd_alunos || c.studentCount,
            };
          });
          setClasses(mapped as CourseClass[]);
        } else console.warn("⚠️ Falha ao carregar turma_secoes:", classes.reason);

        if (cohorts.status === "fulfilled") {
          const mapped = (cohorts.value as any[]).map(c => ({
            ...c,
            id: c.id,
            name: c.nome || c.name,
            entryYear: c.ano_ingresso || c.entryYear,
            color: c.cor_hex || c.color
          }));
          setCohorts(mapped as Cohort[]);
        } else console.warn("⚠️ Falha ao carregar turmas:", cohorts.reason);

        if (visualConfigs.status === "fulfilled")
          setVisualConfigs(visualConfigs.value as VisualConfig[]);
        else
          console.warn(
            "⚠️ Falha ao carregar visualConfigs:",
            visualConfigs.reason,
          );

        if (instructors.status === "fulfilled") {
          const disciplinesList = disciplines.status === "fulfilled" ? (disciplines.value as any[]) : [];
          const mapped = (instructors.value as any[]).map((i) => {
            const rawDisciplines: string[] = i.data?.enabledDisciplines || i.enabledDisciplines || [];
            // Normalize: convert sigla/code references to Supabase id
            const normalizedDisciplines = rawDisciplines.map((ref: string) => {
              const byId = disciplinesList.find((d: any) => d.id === ref);
              if (byId) return ref;
              const byCode = disciplinesList.find((d: any) => d.sigla === ref || d.code === ref);
              return byCode ? byCode.id : ref;
            });
            return {
              ...i,
              trigram: i.trigram || i.trigrama || i.id,
              warName: i.warName || i.nome_guerra || i.trigram || i.trigrama || "Sem Nome",
              fullName: i.name || i.fullName || i.nome_completo || "",
              venture: i.data?.venture || i.venture || i.vinculo || "EFETIVO",
              rank: i.specialty || i.data?.rank || i.rank || i.titulacao || "",
              weeklyLoadLimit: i.data?.weeklyLoadLimit || i.weeklyLoadLimit || i.carga_horaria_max || 12,
              specialty: i.specialty || i.especialidade || "",
              enabledDisciplines: normalizedDisciplines,
              enabledClasses: i.data?.enabledClasses || i.enabledClasses || [],
            };
          });
          setInstructors(mapped as Instructor[]);
        } else
          console.warn("⚠️ Falha ao carregar instructors (tabela instructors):", instructors.reason);

        if (occurrences.status === "fulfilled")
          setOccurrences(occurrences.value as InstructorOccurrence[]);
        else
          console.warn("⚠️ Falha ao carregar ocorrencias:", occurrences.reason);

        if (semesterConfigs.status === "fulfilled")
          setSemesterConfigs(semesterConfigs.value as SemesterConfig[]);
        else
          console.warn(
            "⚠️ Falha ao carregar semester_configs:",
            semesterConfigs.reason,
          );

        if (changeRequests.status === "fulfilled")
          setChangeRequests(changeRequests.value as ScheduleChangeRequest[]);
        else
          console.warn(
            "⚠️ Falha ao carregar solicitacoes_sap:",
            changeRequests.reason,
          );

        console.log(
          "✅ Dados estáticos carregados do Supabase.",
        );
      } catch (err) {
        console.error("❌ Erro crítico ao carregar dados estáticos:", err);
      } finally {
        setDataReady(true);
      }
    };

    loadStaticCollections();

    // Apenas avisos mantêm tempo real
    console.log("🔌 Inscrito em tempo real para avisos (avisos)...");
    const unsubNotices = subscribeToCollection("avisos", (data) =>
      setNotices(data as SystemNotice[]),
    );

    return () => {
      console.log("🔌 Finalizando listener de notices...");
      unsubNotices();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
};
