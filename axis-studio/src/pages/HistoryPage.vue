<template>
  <q-page class="ax-page q-pa-md">
    <div class="ax-panel">

      <!-- Header -->
      <div class="ax-panel-header row items-center">
        <q-icon name="history" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
        <span class="ax-panel-title q-mr-auto">History</span>
        <span class="ax-badge ax-badge--neutral font-mono" style="font-size: 0.65rem">
          {{ history.filtered.length }} entries
        </span>
        <q-btn
          v-if="history.entries.length"
          flat dense round size="xs"
          icon="delete_sweep"
          title="Clear all history"
          class="q-ml-sm"
          style="color: var(--ax-negative)"
          @click="confirmClear"
        />
      </div>

      <!-- Filter bar -->
      <div class="q-px-md q-pt-sm q-pb-xs">
        <q-input
          v-model="history.filterQuery"
          placeholder="Filter by intent or effect…"
          outlined dense clearable
        >
          <template #prepend>
            <q-icon name="filter_list" size="16px" />
          </template>
        </q-input>
      </div>

      <!-- Empty state -->
      <div v-if="!history.filtered.length" class="ax-empty">
        <q-icon name="history" class="ax-empty-icon" />
        <div class="ax-empty-text">
          {{ history.entries.length ? 'No entries match the filter' : 'No history yet — send some intents!' }}
        </div>
      </div>

      <!-- History entries -->
      <q-list v-else separator>
        <q-expansion-item
          v-for="entry in history.filtered"
          :key="entry.id"
          dense
          group="history"
          :header-class="[
            'history-entry',
            entry.status === 'ok' ? 'history-entry--ok' : 'history-entry--err',
          ]"
        >
          <template #header>
            <q-item-section avatar style="min-width: 28px">
              <q-icon
                :name="entry.status === 'ok' ? 'check_circle' : 'error'"
                size="16px"
                :style="{ color: entry.status === 'ok' ? 'var(--ax-positive)' : 'var(--ax-negative)' }"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="font-mono" style="font-size: 0.78rem; font-weight: 500">
                {{ entry.intent }}
              </q-item-label>
              <q-item-label caption style="font-size: 0.68rem; color: var(--ax-text-dim)">
                {{ new Date(entry.ts).toLocaleTimeString() }}
                · {{ entry.durationMs }}ms
                <span v-if="entry.responseEffect"> · {{ entry.responseEffect }}</span>
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-btn
                flat dense round
                icon="close"
                size="xs"
                style="color: var(--ax-text-dim)"
                @click.stop="history.remove(entry.id)"
              />
            </q-item-section>
          </template>

          <!-- Expanded detail -->
          <div class="q-pa-md" style="background: var(--ax-surface-raised)">
            <q-tabs
              v-model="detailTabs[entry.id]"
              dense align="left"
              class="ax-tabs q-mb-sm"
              :active-color="$q.dark.isActive ? 'cyan-3' : 'primary'"
              indicator-color="primary"
            >
              <q-tab name="response" icon="inbox"  label="Response" />
              <q-tab name="request"  icon="send"   label="Request" />
            </q-tabs>

            <q-tab-panels
              :model-value="detailTabs[entry.id] ?? 'response'"
              animated
              class="transparent-panels"
              @update:model-value="(v: string) => (detailTabs[entry.id] = v)"
            >
              <q-tab-panel name="response" class="q-pa-none">
                <JsonTree :value="parseSafe(entry.responseBody)" max-height="320px" />
              </q-tab-panel>
              <q-tab-panel name="request" class="q-pa-none">
                <JsonTree :value="parseSafe(entry.requestBody)" max-height="320px" />
              </q-tab-panel>
            </q-tab-panels>

            <div style="font-size: 0.68rem; color: var(--ax-text-dim); margin-top: 8px" class="font-mono">
              Node: {{ entry.nodeUrl }} · ID: {{ entry.id.slice(0, 12) }}…
            </div>
          </div>
        </q-expansion-item>
      </q-list>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useQuasar } from 'quasar';
import JsonTree from 'src/components/JsonTree.vue';
import { useHistoryStore } from 'stores/history';

const $q      = useQuasar();
const history = useHistoryStore();

const detailTabs = reactive<Record<string, string>>({});

function parseSafe(raw: string): unknown {
  try { return JSON.parse(raw); }
  catch { return raw; }
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
