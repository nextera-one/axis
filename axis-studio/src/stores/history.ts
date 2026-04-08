import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface HistorySnapshot {
  transport: string;
  tree: unknown;
  raw: string;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  intent: string;
  requestBody: string;
  responseBody: string;
  responseEffect: string;
  durationMs: number;
  status: 'ok' | 'error';
  nodeUrl: string;
  httpStatus?: number;
  requestSnapshot?: HistorySnapshot;
  responseSnapshot?: HistorySnapshot;
}

const MAX_ENTRIES = 500;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('axis_history');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(loadHistory());
  const filterQuery = ref('');

  function persist() {
    localStorage.setItem('axis_history', JSON.stringify(entries.value));
  }

  function push(entry: HistoryEntry) {
    entries.value.unshift(entry);
    if (entries.value.length > MAX_ENTRIES) entries.value.length = MAX_ENTRIES;
    persist();
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id);
    persist();
  }

  function clear() {
    entries.value = [];
    persist();
  }

  const filtered = computed(() => {
    const q = filterQuery.value.toLowerCase();
    if (!q) return entries.value;
    return entries.value.filter(
      (e) =>
        e.intent.toLowerCase().includes(q) ||
        e.responseEffect.toLowerCase().includes(q),
    );
  });

  return { entries, filterQuery, filtered, push, remove, clear };
});
