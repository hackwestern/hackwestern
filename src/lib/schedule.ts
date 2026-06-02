import type { DaySchedule } from "~/types/schedule";

export async function fetchScheduleData(): Promise<DaySchedule[]> {
  try {
    const response = await fetch("/api/schedule");
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule data: ${response.statusText}`);
    }

    const data = (await response.json()) as DaySchedule[];
    return data;
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return [];
  }
}

export function getTimeInMinutes(timeStr: string): number {
  if (!timeStr) return 0;

  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;

  let hours = parseInt(match[1]!);
  const minutes = parseInt(match[2]!);
  const period = match[3]!.toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}
