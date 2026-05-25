import { seedItems } from "./data";
import type { WorkItem } from "./domain";

const storageKey = "sprintscope.items.v1";

export function loadItems(): WorkItem[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return seedItems;

    const parsed = JSON.parse(stored) as WorkItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedItems;
  } catch {
    return seedItems;
  }
}

export function saveItems(items: WorkItem[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

export function resetItems(): WorkItem[] {
  localStorage.removeItem(storageKey);
  return seedItems;
}
