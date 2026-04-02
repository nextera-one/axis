<template>
  <q-page class="ax-page q-pa-md">
    <div class="ax-panel">

      <!-- Header -->
      <div class="ax-panel-header row items-center">
        <q-icon name="history" color="primary" size="15px" class="q-mr-xs" />
        <span class="ax-panel-title q-mr-auto">History</span>
        <q-chip
          dense
          size="sm"
          :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
          :text-color="$q.dark.isActive ? 'grey-4' : 'grey-7'"
        >
          {{ history.filtered.length }} entries
        </q-chip>
        <q-btn
          v-if="history.entries.length"
          flat dense round size="xs"
          icon="delete_sweep"
          color="negative"
          title="Clear all history"
          class="q-ml-sm"
          @click="confirmClear"
        />
      </div>

      <!-- Filter bar -->
      <div class="q-px-md q-pt-sm q-pb-xs">
        <q-input
          v-model="history.filterQuery"
          placeholder="Filter by intent or effect…"
          outlined
          dense
          clearable
        >
          <template #prepend>
            <q-icon name="filter_list" size="16px" />
          </template>
        </q-input>
      </div>

      <!-- Empty state -->
      <div
        v-if="!history.filtered.length"
        class="column items-center justify-center q-pa-xl"
      >
        <q-icon
          name="history"
          size="48px"
          :color="$q.dark.isActive ? 'grey-8' : 'grey-4'"
          class="q-mb-md"
        />
        <div
          class="text-body2"
          :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
        >
          {{
            history.entries.length
              ? 'No entries match the filter'
              : 'No history yet — send some intents!'
          }}
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
            <!-- Status icon -->
            <q-item-section avatar style="min-width: 28px">
              <q-icon
                :name="entry.status === 'ok' ? 'check_circle' : 'error'"
                :color="entry.status === 'ok' ? 'positive' : 'negative'"
                size="16px"
              />
            </q-item-section>

            <!-- Intent + meta -->
            <q-item-section>
              <q-item-label class="font-mono text-caption text-weight-medium">
                {{ entry.intent }}
              </q-item-label>
              <q-item-label caption>
                {{ new Date(entry.ts).toLocaleTimeString() }}
                · {{ entry.durationMs }}ms
                <span v-if="entry.responseEffect"> · {{ entry.responseEffect }}</span>
              </q-item-label>
            </q-item-section>

            <!-- Delete -->
            <q-item-section side>
              <q-btn
                flat dense round
                icon="close"
                size="xs"
                :color="$q.dark.isActive ? 'grey-6' : 'grey-5'"
                @click.stop="history.remove(entry.id)"
              />
            </q-item-section>
          </template>

          <!-- Expanded detail -->
          <div
            class="q-pa-md"
            :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
          >
            <q-tabs
              v-model="detailTabs[entry.id]"
              dense
              align="left"
              :active-color="$q.dark.isActive ? 'cyan-3' : 'primary'"
              indicator-color="primary"
              class="q-mb-sm"
            >
              <q-tab name="response" icon="inbox"  label="Response" />
              <q-tab name="request"  icon="send"   label="Request" />
            </q-tabs>

            <q-tab-panels
              :model-value="detailTabs[entry.id] ?? 'response'"
              animated
              class="transparent-panels"
              @update:model-value="(v) => (detailTabs[entry.id] = v)"
            >
              <q-tab-panel name="response" class="q-pa-none">
                <JsonTree
                  :value="parseSafe(entry.responseBody)"
                  max-height="320px"
                />
              </q-tab-panel>
              <q-tab-panel name="request" class="q-pa-none">
                <JsonTree
                  :value="parseSafe(entry.requestBody)"
                  max-height="320px"
                />
              </q-tab-panel>
            </q-tab-panels>

            <!-- Footer meta -->
            <div
              class="text-caption q-mt-sm"
              :class="$q.dark.isActive ? 'text-grey-7' : 'text-grey-6'"
            >
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

// Per-entry active tab state
const detailTabs = reactive<Record<string, string>>({});

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

