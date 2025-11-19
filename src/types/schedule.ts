export interface ScheduleEvent {
  "Time (EST)": string;
  "Big Event": string;
  "Sponsor Workshop": string;
  "Other Workshop": string;
  "Activities #1": string;
  "Activities #2": string;
  Food: string;
  "Spon Booth": string;
  Other: string;
}

export interface ParsedScheduleEvent {
  time: string;
  bigEvent?: { title: string; location: string };
  sponsorWorkshop?: { title: string; location: string };
  otherWorkshop?: { title: string; location: string };
  activities1?: { title: string; location: string };
  activities2?: { title: string; location: string };
  food?: { title: string; location: string };
  sponsorBooth?: { title: string; location: string };
  other?: { title: string; location: string };
}

export interface DaySchedule {
  day: string;
  events: ParsedScheduleEvent[];
}
