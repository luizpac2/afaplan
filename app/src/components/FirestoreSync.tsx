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
          fetchCollectionCached("disciplines"),
          fetchCollectionCached("classes"),
          fetchCollectionCached("cohorts"),
          fetchCollectionCached("visualConfigs"),
          fetchCollectionCached("instructors"),
          fetchCollectionCached("occurrences"),
          fetchCollectionCached("semester_configs"),
          fetchCollectionCached("schedule_change_requests"),
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

        if (disciplines.status === "fulfilled")
          setDisciplines(disciplines.value as Discipline[]);
        else
          console.warn("⚠️ Falha ao carregar disciplines:", disciplines.reason);

        if (classes.status === "fulfilled")
          setClasses(classes.value as CourseClass[]);
        else console.warn("⚠️ Falha ao carregar classes:", classes.reason);

        if (cohorts.status === "fulfilled")
          setCohorts(cohorts.value as Cohort[]);
        else console.warn("⚠️ Falha ao carregar cohorts:", cohorts.reason);

        if (visualConfigs.status === "fulfilled")
          setVisualConfigs(visualConfigs.value as VisualConfig[]);
        else
          console.warn(
            "⚠️ Falha ao carregar visualConfigs:",
            visualConfigs.reason,
          );

        if (instructors.status === "fulfilled") {
          const mapped = (instructors.value as any[]).map((i) => ({
            ...i,
            trigram: i.trigram || i.id,
          }));
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
          console.warn(
            "⚠️ Falha ao carregar semester_configs:",
            semesterConfigs.reason,
          );

        if (changeRequests.status === "fulfilled")
          setChangeRequests(changeRequests.value as ScheduleChangeRequest[]);
        else
          console.warn(
            "⚠️ Falha ao carregar schedule_change_requests:",
            changeRequests.reason,
          );

        console.log(
          "✅ Dados estáticos carregados (resultados parciais aceitos).",
        );
      } catch (err) {
        console.error("❌ Erro crítico ao carregar dados estáticos:", err);
      } finally {
        // Sinaliza que tentou carregar — páginas podem renderizar com o que foi obtido
        setDataReady(true);
      }
    };

    loadStaticCollections();

    // Apenas notices mantém onSnapshot: avisos do sistema precisam aparecer
    // em tempo real para todos os usuários sem precisar recarregar.
    console.log("🔌 Iniciando listener em tempo real apenas para notices...");
    const unsubNotices = subscribeToCollection("notices", (data) =>
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
