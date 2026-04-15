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
 * SupabaseSync — carrega dados estáticos com fetchCollectionCached (usando persistência local TTL 4h)
 * e mantém listener APENAS para notices (avisos do sistema, precisam de atualização em tempo real).
 *
 * Economia estimada: -90% das leituras diárias do Supabase.
 */
export const SupabaseSync = () => {
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

    // Coleções estáticas: carregadas UMA VEZ ao login ou do localStorage se < 4h
    const loadStaticCollections = async () => {
      try {
        const results = await Promise.allSettled([
          fetchCollectionCached("disciplines"),   // tabela real com 209 linhas
          fetchCollectionCached("cohorts"),        // tabela real com 4 turmas
          fetchCollectionCached("cohorts"),        // reutilizado para classes abaixo
          fetchCollectionCached("visual_configs"),
          fetchCollectionCached("instructors"),
          fetchCollectionCached("occurrences"),
          fetchCollectionCached("semester_configs"),
          fetchCollectionCached("schedule_change_requests"),
        ]);

        const [
          disciplines,
          cohorts,
          _cohorts2,
          visualConfigs,
          instructors,
          occurrences,
          semesterConfigs,
          changeRequests,
        ] = results;

        if (disciplines.status === "fulfilled") {
          // O campo `data` é um JSONB que armazena enabledCourses, enabledYears,
          // ppcLoads, trainingField, location — expande para o nível raiz.
          // Também suporta fallbacks PT/EN para compatibilidade.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const expanded = (disciplines.value as any[]).map((d) => ({
            ...d,
            ...(d.data && typeof d.data === "object" ? d.data : {}),
            id: d.id,
            code: (d.sigla || d.code || d.id || "").toUpperCase(),
            name: d.nome || d.name || "Sem Nome",
            trainingField: d.campo || d.trainingField || d.data?.trainingField || "GERAL",
            load_hours: d.carga_horaria || d.load_hours,
          }));
          setDisciplines(expanded as Discipline[]);
        } else console.warn("⚠️ Falha ao carregar disciplines:", disciplines.reason);

        // Deriva classes (CourseClass) a partir das turmas/cohorts
        if (cohorts.status === "fulfilled") {
          const currentYear = new Date().getFullYear();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedClasses = (cohorts.value as any[]).map((t: any) => {
            const entryYear = t.entryYear || t.ano_ingresso;
            const computedYear = entryYear ? Math.min(4, Math.max(1, currentYear - entryYear + 1)) : 1;
            return {
              id: String(t.id),
              name: t.name || t.nome || "?",
              year: computedYear as 1 | 2 | 3 | 4,
              type: "AVIATION" as const,
              studentCount: t.qtd_alunos,
            };
          });
          setClasses(mappedClasses as CourseClass[]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedCohorts = (cohorts.value as any[]).map((c) => ({
            ...c,
            id: c.id,
            name: c.nome || c.name,
            entryYear: c.ano_ingresso || c.entryYear,
            color: c.cor_hex || c.color,
          }));
          setCohorts(mappedCohorts as Cohort[]);
        } else console.warn("⚠️ Falha ao carregar cohorts:", cohorts.reason);

        if (visualConfigs.status === "fulfilled")
          setVisualConfigs(visualConfigs.value as VisualConfig[]);
        else
          console.warn("⚠️ Falha ao carregar visual_configs:", visualConfigs.reason);

        if (instructors.status === "fulfilled") {
          // Busca vínculos docente↔disciplina da tabela docente_disciplinas
          const ddMap: Record<string, string[]> = {};
          try {
            const { supabase } = await import("../config/supabase");
            const { data: ddRows } = await supabase
              .from("docente_disciplinas")
              .select("docente_id, disciplina_id");
            if (ddRows) {
              for (const row of ddRows) {
                if (!ddMap[row.docente_id]) ddMap[row.docente_id] = [];
                ddMap[row.docente_id].push(row.disciplina_id);
              }
            }
          } catch { /* silently ignore */ }

          const disciplinesList = disciplines.status === "fulfilled" ? (disciplines.value as any[]) : [];
          const turmasList = cohorts.status === "fulfilled" ? (cohorts.value as any[]) : [];
          const currentYear = new Date().getFullYear();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = (instructors.value as any[]).map((i) => {
            // enabledDisciplines: docente_disciplinas usa trigram como docente_id
            const rawDisciplines: string[] = ddMap[i.trigram] || ddMap[i.id] || i.data?.enabledDisciplines || i.enabledDisciplines || [];
            const normalizedDisciplines = rawDisciplines.map((ref: string) => {
              const byId = disciplinesList.find((d: any) => d.id === ref);
              if (byId) return ref;
              const byCode = disciplinesList.find((d: any) => d.sigla === ref || d.code === ref);
              return byCode ? byCode.id : ref;
            });

            const rawClasses: string[] = i.data?.enabledClasses || i.enabledClasses || [];
            const normalizedClasses = [...new Set(rawClasses.map((ref: string) => {
              if (turmasList.find((t: any) => String(t.id) === ref)) return ref;
              const yearMatch = ref.match(/^(\d)/);
              if (yearMatch) {
                const legacyYear = parseInt(yearMatch[1]);
                const turma = turmasList.find((t: any) => {
                  const entryYear = t.entryYear || t.ano_ingresso;
                  return entryYear && Math.min(4, Math.max(1, currentYear - entryYear + 1)) === legacyYear;
                });
                if (turma) return String(turma.id);
              }
              return ref;
            }))];

            return {
              ...(i.data && typeof i.data === "object" ? i.data : {}),
              ...i,
              trigram: i.trigram || i.trigrama || i.id,
              warName: i.warName || i.nome_guerra || i.trigram || "Sem Nome",
              fullName: i.name || i.data?.fullName || i.fullName || i.nome_completo || "",
              venture: i.data?.venture || i.venture || i.vinculo || "EFETIVO",
              rank: i.data?.rank || i.rank || i.specialty || i.titulacao || "",
              weeklyLoadLimit: i.data?.weeklyLoadLimit || i.weeklyLoadLimit || i.carga_horaria_max || 12,
              specialty: i.specialty || i.especialidade || "",
              enabledDisciplines: normalizedDisciplines,
              enabledClasses: normalizedClasses,
            };
          });
          setInstructors(mapped as Instructor[]);
        } else
          console.warn("⚠️ Falha ao carregar instructors:", instructors.reason);

        if (occurrences.status === "fulfilled")
          setOccurrences(occurrences.value as InstructorOccurrence[]);
        else
          console.warn("⚠️ Falha ao carregar occurrences:", occurrences.reason);

        if (semesterConfigs.status === "fulfilled")
          setSemesterConfigs(semesterConfigs.value as SemesterConfig[]);
        else
          console.warn("⚠️ Falha ao carregar semester_configs:", semesterConfigs.reason);

        if (changeRequests.status === "fulfilled")
          setChangeRequests(changeRequests.value as ScheduleChangeRequest[]);
        else
          console.warn("⚠️ Falha ao carregar schedule_change_requests:", changeRequests.reason);

      } catch (err) {
        console.error("❌ Erro crítico ao carregar dados estáticos:", err);
      } finally {
        setDataReady(true);
      }
    };

    loadStaticCollections();

    const unsubNotices = subscribeToCollection("notices", (data) =>
      setNotices(data as SystemNotice[]),
    );

    return () => { unsubNotices(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
};
