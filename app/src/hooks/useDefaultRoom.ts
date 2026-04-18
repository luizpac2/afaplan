import { useMemo } from "react";
import { useCourseStore } from "../store/useCourseStore";

/**
 * Retorna o nome do local padrão para uma turma de aula em um dado ano letivo.
 * Chave de lookup: visual_configs id = "default_rooms_YYYY"
 * data = { "1A": locationId, "2B": locationId, ... }
 */
export function useDefaultRoom(classId: string | undefined, year = new Date().getFullYear()): string {
  const { visualConfigs, locations } = useCourseStore();

  return useMemo(() => {
    if (!classId) return "";
    const cfg = visualConfigs.find((v) => v.id === `default_rooms_${year}`);
    if (!cfg) return "";
    const data = cfg.data as Record<string, string> | undefined;
    const locationId = data?.[classId];
    if (!locationId) return "";
    return locations.find((l) => l.id === locationId)?.name ?? "";
  }, [visualConfigs, locations, classId, year]);
}

/**
 * Retorna o mapa classId → locationId para o ano dado.
 */
export function useDefaultRoomsMap(year = new Date().getFullYear()): Record<string, string> {
  const { visualConfigs } = useCourseStore();
  return useMemo(() => {
    const cfg = visualConfigs.find((v) => v.id === `default_rooms_${year}`);
    return (cfg?.data as Record<string, string>) ?? {};
  }, [visualConfigs, year]);
}
