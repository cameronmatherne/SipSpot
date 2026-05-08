import type { TimeWindow, Weekday } from "../data/spots";
import type { Spot } from "../data/spots";

// Must match JavaScript's Date.getDay() order (0 = Sunday).
export const WEEKDAY_ORDER: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Converts a "HH:MM" string to total minutes from midnight (for comparisons).
export const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

// Formats a 24h "HH:MM" string as a human-readable 12h time, e.g. "4:00 PM".
export const formatTime = (value: string) => {
  const [rawHours, rawMinutes] = value.split(":").map(Number);
  const hours = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const suffix = rawHours >= 12 ? "PM" : "AM";
  return `${hours}:${rawMinutes.toString().padStart(2, "0")} ${suffix}`;
};

// Returns true if the given happy-hour window is happening right now.
export const isWindowActive = (window: TimeWindow, now: Date) => {
  const dayLabel = WEEKDAY_ORDER[now.getDay()];
  if (!window.days.includes(dayLabel)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(window.start);
  const endMinutes = toMinutes(window.end);
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// Returns true if the given daily deal is active right now.
// Deals with no start/end are treated as "All Day" and are always active.
export const isDealActive = (deal: Spot["dailyDeals"][number], now: Date) => {
  if (!deal.start || !deal.end) return true; // All Day
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(deal.start);
  const endMinutes = toMinutes(deal.end);
  if (endMinutes >= startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  // Cross-midnight window (e.g. 19:00-02:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

// Finds the next upcoming happy-hour window within the next 7 days.
export const getNextWindow = (windows: TimeWindow[], now: Date) => {
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (currentDayIndex + offset) % 7;
    const dayLabel = WEEKDAY_ORDER[dayIndex];

    for (const window of windows) {
      if (!window.days.includes(dayLabel)) continue;

      const startMinutes = toMinutes(window.start);
      if (offset === 0 && currentMinutes < startMinutes) {
        return { day: dayLabel, start: window.start };
      }

      if (offset > 0) {
        return { day: dayLabel, start: window.start };
      }
    }
  }

  return null;
};

export const formatNextStartLabel = (day: Weekday, start: string) => {
  const nowDay = WEEKDAY_ORDER[new Date().getDay()];
  if (day === nowDay) return formatTime(start);
  return `${day} at ${formatTime(start)}`;
};

export const isWorkweek = (days: Weekday[]) => {
  const workweek: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return days.length === 5 && workweek.every((day) => days.includes(day));
};

export const joinDays = (days: Weekday[]) => {
  if (days.length === 7) return "Daily";

  const sorted = [...days].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );

  if (isWorkweek(sorted)) return "Mon-Fri";
  return sorted.join(", ");
};

export const fullWeekdayLabel = (day: Weekday) => {
  const fullNames: Record<Weekday, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return fullNames[day];
};
