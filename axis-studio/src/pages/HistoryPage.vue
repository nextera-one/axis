<template>
  <div class="ax-page" style="display: flex; height: 100%; overflow: hidden">

    <!-- ══════ LEFT: EXECUTION TABLE ══════════════════ -->
    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0">

      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px 10px;
        flex-shrink: 0;
      ">
        <h1 style="
          font-family: var(--ax-font-headline);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ax-on-surface);
          margin: 0;
          letter-spacing: -0.01em;
        ">Execution History</h1>
        <span class="font-mono" style="
          font-size: 0.65rem;
          color: var(--ax-outline);
          background: var(--ax-surface-low);
          padding: 2px 8px;
          border-radius: 3px;
        ">{{ history.filtered.length }} entries</span>
        <q-space />
        <q-btn
          v-if="history.entries.length"
          flat dense no-caps size="xs"
          style="color: var(--ax-error); font-family: var(--ax-font-mono); font-size: 0.65rem"
          @click="confirmClear"
        >
          <span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px">delete_sweep</span>
          CLEAR
        </q-btn>
      </div>

      <!-- Filter -->
      <div style="padding: 0 18px 10px; flex-shrink: 0">
        <q-input
          v-model="history.filterQuery"
          placeholder="Filter by intent or effect…"
          outlined dense clearable
          style="max-width: 360px"
        >
          <template #prepend>
            <span class="material-symbols-outlined" style="font-size: 18px; color: var(--ax-outline)">filter_list</span>
          </template>
        </q-input>
      </div>

      <!-- Table header -->
      <div style="
        display: grid;
        grid-template-columns: 36px 1fr 100px 70px 60px 36px;
        gap: 4px;
        padding: 0 18px;
        align-items: center;
        min-height: 30px;
        font-family: var(--ax-font-mono);
        font-size: 0.6rem;
        font-weight: 700;
        color: var(--ax-outline);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        border-bottom: 1px solid var(--ax-border);
        flex-shrink: 0;
      ">
        <span></span>
        <span>Intent</span>
        <span>Effect</span>
        <span style="text-align: right">Latency</span>
        <span style="text-align: right">Status</span>
        <span></span>
      </div>

      <!-- Table rows -->
      <div style="flex: 1; overflow-y: auto; min-height: 0">
        <div v-if="!history.filtered.length" class="ax-empty" style="padding: 48px 16px">
          <span class="material-symbols-outlined ax-empty-icon" style="font-size: 36px">history</span>
          <div class="ax-empty-text">
            {{ history.entries.length ? 'No entries match the filter' : 'No history yet — send some intents!' }}
          </div>
        </div>

        <div
          v-for="entry in history.filtered"
          :key="entry.id"
          :class="['ax-history-row', { 'ax-history-row--selected': selectedId === entry.id }]"
          @click="selectedId = entry.id"
        >
          <!-- Status icon -->
          <span class="material-symbols-outlined" :style="{
            fontSize: '16px',
            color: entry.status === 'ok' ? 'var(--ax-positive)' : 'var(--ax-error)',
          }">{{ entry.status === 'ok' ? 'check_circle' : 'error' }}</span>

          <!-- Intent name -->
          <div style="min-width: 0">
            <div class="font-mono" style="font-size: 0.75rem; font-weight: 500; color: var(--ax-on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ entry.intent }}
            </div>
            <div class="font-mono" style="font-size: 0.58rem; color: var(--ax-outline)">
              {{ new Date(entry.ts).toLocaleTimeString() }} · {{ entry.id.slice(0, 8) }}
            </div>
          </div>

          <!-- Effect -->
          <span class="font-mono" style="font-size: 0.65rem; color: var(--ax-on-surface-variant)">
            {{ entry.responseEffect || '—' }}
          </span>

          <!-- Latency -->
          <span class="font-mono" style="font-size: 0.68rem; color: var(--ax-on-surface); text-align: right">
            {{ entry.durationMs }}ms
          </span>

          <!-- Status badge -->
          <span
            class="ax-badge font-mono"
            :class="entry.status === 'ok' ? 'ax-badge--ok' : 'ax-badge--error'"
            style="font-size: 0.55rem; justify-self: end"
          >{{ entry.status === 'ok' ? '200' : 'ERR' }}</span>

          <!-- Delete -->
          <q-btn
            flat dense round size="xs"
            style="color: var(--ax-outline)"
            @click.stop="history.remove(entry.id)"
          >
            <span class="material-symbols-outlined" style="font-size: 14px">close</span>
          </q-btn>
        </div>
      </div>
    </div>

    <!-- ══════ RIGHT: TRACE PANEL ═══════════════════ -->
    <div
      v-if="selectedEntry"
      style="
        width: 380px;
        flex-shrink: 0;
        border-left: 1px solid var(--ax-border);
        background: var(--ax-surface);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      "
    >
      <!-- Trace header -->
      <div style="
        padding: 12px 14px;
        border-bottom: 1px solid var(--ax-border);
        flex-shrink: 0;
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--ax-primary)">timeline</span>
          <span style="
            font-family: var(--ax-font-headline);
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--ax-on-surface);
            flex: 1;
          ">Trace Summary</span>
          <q-btn flat dense round size="xs" style="color: var(--ax-outline)" @click="selectedId = ''">
            <span class="material-symbols-outlined" style="font-size: 16px">close</span>
          </q-btn>
        </div>
        <div class="font-mono" style="font-size: 0.68rem; color: var(--ax-primary)">{{ selectedEntry.intent }}</div>
        <div class="font-mono" style="font-size: 0.58rem; color: var(--ax-outline); margin-top: 2px">
          {{ new Date(selectedEntry.ts).toLocaleString() }}
        </div>
      </div>

      <!-- Trace steps -->
      <div style="padding: 14px; flex-shrink: 0">
        <div
          v-for="(step, i) in traceSteps"
          :key="i"
          class="ax-trace-step"
        >
          <div class="ax-trace-dot" :style="{ background: step.color }" />
          <div style="flex: 1">
            <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-on-surface)">{{ step.label }}</div>
            <div class="font-mono" style="font-size: 0.58rem; color: var(--ax-outline)">{{ step.detail }}</div>
          </div>
        </div>
      </div>

      <!-- Response / Request tabs -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0">
        <q-tabs
          v-model="detailTabs[selectedEntry.id]"
          dense
          align="left"
          class="ins-tabs"
          indicator-color="primary"
          style="flex-shrink: 0"
        >
          <q-tab name="response" label="Response" no-caps />
          <q-tab name="request" label="Request" no-caps />
        </q-tabs>

        <q-tab-panels
          :model-value="detailTabs[selectedEntry.id] ?? 'response'"
          animated
          class="transparent-panels"
          style="flex: 1; overflow: hidden; min-height: 0"
          @update:model-value="(v) => (detailTabs[selectedEntry.id] = v)"
        >
          <q-tab-panel name="response" class="q-pa-none" style="height: 100%; overflow: hidden">
            <JsonTree
              :value="parseSafe(selectedEntry.responseBody)"
              max-height="100%"
              style="height: 100%; border: none"
            />
          </q-tab-panel>
          <q-tab-panel name="request" class="q-pa-none" style="height: 100%; overflow: hidden">
            <JsonTree
              :value="parseSafe(selectedEntry.requestBody)"
              max-height="100%"
              style="height: 100%; border: none"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- Footer -->
      <div style="
        padding: 8px 14px;
        border-top: 1px solid var(--ax-border);
        font-family: var(--ax-font-mono);
        font-size: 0.58rem;
        color: var(--ax-outline);
        flex-shrink: 0;
      ">
        Node: {{ selectedEntry.nodeUrl }} · ID: {{ selectedEntry.id.slice(0, 12) }}…
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useQuasar } from 'quasar';
import JsonTree from 'src/components/JsonTree.vue';
import { useHistoryStore } from 'stores/history';

const $q = useQuasar();
const history = useHistoryStore();

const selectedId = ref('');
const detailTabs = reactive<Record<string, string>>({});

const selectedEntry = computed(() =>
  history.filtered.find(e => e.id === selectedId.value) ?? null,
);

const traceSteps = computed(() => {
  if (!selectedEntry.value) return [];
  const e = selectedEntry.value;
  return [
    { label: 'Intent Sent', detail: e.intent, color: 'var(--ax-primary)' },
    { label: 'Frame Assembled', detail: `${e.durationMs}ms latency`, color: 'var(--ax-primary)' },
    { label: 'Node Response', detail: e.status === 'ok' ? 'Success' : 'Error', color: e.status === 'ok' ? 'var(--ax-positive)' : 'var(--ax-error)' },
    ...(e.responseEffect ? [{ label: 'Effect', detail: e.responseEffect, color: 'var(--ax-warning)' }] : []),
  ];
});

function parseSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function confirmClear() {
  $q.dialog({
    title: 'Clear History',
    message: 'Delete all history entries? This cannot be undone.',
    cancel: { flat: true },
    ok: { label: 'Clear All', color: 'negative', flat: true },
    persistent: true,
  }).onOk(() => history.clear());
}
</script>

<style scoped>
.ax-history-row {
  display: grid;
  grid-template-columns: 36px 1fr 100px 70px 60px 36px;
  gap: 4px;
  padding: 8px 18px;
  align-items: center;
  cursor: pointer;
  transition: background 0.12s;
  border-left: 3px solid transparent;
}
.ax-history-row:hover {
  background: var(--ax-surface-low);
}
.ax-history-row--selected {
  background: var(--ax-surface-low);
  border-left-color: var(--ax-primary);
}
</style>
