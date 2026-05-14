import type { BookEntry, SystemEntry } from '../data/bobiverse';

export function spoilerLevelFor(book: Pick<BookEntry, 'spoilerLevel'> | number): number {
  return typeof book === 'number' ? book : book.spoilerLevel;
}

export function yearRangeLabel(systems: SystemEntry[]): string {
  const years = systems.flatMap((item) => item.events.map((event) => event.year));
  if (years.length === 0) return 'n/a';
  return `${Math.min(...years)}–${Math.max(...years)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatEventDate(year: number, month?: number | null, day?: number | null): string {
  const mm = month ? String(month).padStart(2, '0') : null;
  const dd = day ? String(day).padStart(2, '0') : null;
  if (mm && dd) return `${year}-${mm}-${dd}`;
  if (mm) return `${year}-${mm}`;
  return String(year);
}
