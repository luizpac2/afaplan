import { useMemo } from "react";
import { useCourseStore } from "../store/useCourseStore";

export function useDefaultRoom(classId: string | undefined, year = new Date().getFullYear()): string {
  const { appConfigs, locations } = useCourseStore();

  return useMemo(() => {
    if (!classId) return "";
    const data = appConfigs[`default_rooms_${year}`] as Record<string, string> | undefined;
    const locationId = data?.[classId];
    if (!locationId) return "";
    return locations.find((l) => l.id === locationId)?.name ?? "";
  }, [appConfigs, locations, classId, year]);
}

export function useDefaultRoomsMap(year = new Date().getFullYear()): Record<string, string> {
  const { appConfigs } = useCourseStore();
  return useMemo(() => {
    return (appConfigs[`default_rooms_${year}`] as Record<string, string>) ?? {};
  }, [appConfigs, year]);
}
