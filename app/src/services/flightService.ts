import { supabase } from "../config/supabase";
import type { FlightDay, AircraftType } from "../types";

const TABLE = "flight_days";

/** Fetch all flight days for a given year */
export const fetchFlightDaysByYear = async (year: number): Promise<FlightDay[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");
  if (error) throw error;
  return (data ?? []) as FlightDay[];
};

/** Toggle a flight day: if it exists, delete it; otherwise, create it */
export const toggleFlightDay = async (
  date: string,
  aircraft: AircraftType,
  userId?: string,
): Promise<{ added: boolean }> => {
  // Check if already exists
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id")
    .eq("date", date)
    .eq("aircraft", aircraft)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from(TABLE).delete().eq("id", existing.id);
    if (error) throw error;
    return { added: false };
  }

  const { error } = await supabase.from(TABLE).insert({
    date,
    aircraft,
    createdBy: userId ?? null,
  });
  if (error) throw error;
  return { added: true };
};

/** Bulk-set flight days for an aircraft in a month (replaces existing) */
export const setFlightDaysForMonth = async (
  year: number,
  month: number, // 0-indexed
  aircraft: AircraftType,
  dates: string[],
  userId?: string,
): Promise<void> => {
  const monthStr = String(month + 1).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Delete all existing for this aircraft+month
  const { error: delErr } = await supabase
    .from(TABLE)
    .delete()
    .eq("aircraft", aircraft)
    .gte("date", startDate)
    .lte("date", endDate);
  if (delErr) throw delErr;

  // Insert new ones
  if (dates.length > 0) {
    const rows = dates.map((d) => ({
      date: d,
      aircraft,
      createdBy: userId ?? null,
    }));
    const { error: insErr } = await supabase.from(TABLE).insert(rows);
    if (insErr) throw insErr;
  }
};

/** Subscribe to real-time changes on flight_days */
export const subscribeToFlightDays = (
  year: number,
  callback: (data: FlightDay[]) => void,
) => {
  const fetch = async () => {
    const data = await fetchFlightDaysByYear(year);
    callback(data);
  };

  void fetch();

  const channel = supabase
    .channel(`flight_days:${year}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => {
      void fetch();
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
