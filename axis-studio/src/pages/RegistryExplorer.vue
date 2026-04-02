<template>
  <q-page class="ax-page q-pa-md">
    <div class="row q-col-gutter-md">

      <!-- ══════ INTENT LIST ═════════════════════════════════════════════ -->
      <div class="col-12 col-md-4">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center">
            <q-icon name="menu_book" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title">Registry</span>
            <q-space />
            <q-btn
              flat dense round size="xs"
              icon="refresh"
              :loading="loading"
              title="Fetch catalog"
              @click="loadCatalog"
            />
          </div>

          <div class="q-px-sm q-pt-sm q-pb-xs">
            <q-input
              v-model="search"
              placeholder="Search intents…"
              outlined dense clearable
            >
              <template #prepend>
                <q-icon name="search" size="16px" />
              </template>
            </q-input>
          </div>

          <!-- Stats bar -->
          <div
            class="row items-center q-px-md q-py-xs"
            style="border-bottom: 1px solid var(--ax-border)"
          >
            <span style="font-size: 0.72rem; color: var(--ax-text-dim)">
              {{ filteredIntents.length }} / {{ intents.length }} intents
            </span>
            <q-space />
            <span v-if="loading" class="ax-badge ax-badge--info" style="font-size: 0.6rem">
              <q-spinner size="10px" /> Loading
            </span>
          </div>

          <!-- Intent list -->
          <div style="max-height: calc(100vh - 260px); overflow-y: auto">
            <q-list dense separator>
              <q-item
                v-for="item in filteredIntents"
                :key="item.intent"
                clickable
                v-ripple
                :active="selected?.intent === item.intent"
                active-class="registry-item--active"
                class="registry-item"
                @click="selected = item"
              >
                <q-item-section>
                  <q-item-label class="font-mono" style="font-size: 0.76rem; font-weight: 500">
                    {{ item.intent }}
                  </q-item-label>
                  <q-item-label
                    v-if="item.description"
                    caption
                    class="ellipsis"
                    style="max-width: 200px; font-size: 0.68rem"
                  >
                    {{ item.description }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <span
                    class="ax-badge font-mono"
                    :class="'ax-badge--' + sensitivityVariant(item.sensitivity)"
                    style="font-size: 0.58rem"
                  >
                    {{ item.sensitivity }}
                  </span>
                </q-item-section>
              </q-item>

              <!-- Empty state -->
              <q-item v-if="!filteredIntents.length && !loading">
                <q-item-section class="ax-empty" style="padding: 32px 16px">
                  <q-icon name="search_off" class="ax-empty-icon" style="font-size: 28px" />
                  <div class="ax-empty-text">
                    {{ intents.length ? 'No matches' : 'Click refresh to load catalog' }}
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>

      <!-- ══════ DETAIL PANEL ════════════════════════════════════════════ -->
      <div class="col-12 col-md-8">

        <!-- No selection -->
        <div v-if="!selected" class="ax-panel ax-empty" style="min-height: 300px">
          <q-icon name="menu_book" class="ax-empty-icon" style="font-size: 52px" />
          <div class="ax-empty-text">Select an intent to see its details</div>
        </div>

        <!-- Selected intent detail -->
        <div v-else class="ax-panel ax-panel-accent" style="position: relative">
          <div class="ax-panel-header row items-center no-wrap">
            <q-icon name="info" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title font-mono q-mr-auto ellipsis">
              {{ selected.intent }}
            </span>
            <q-btn
              flat dense
              icon="send"
              label="Open in Sender"
              size="sm"
              style="color: var(--ax-primary)"
              @click="openInSender(selected.intent)"
            />
          </div>

          <div class="q-pa-md">
            <!-- Description -->
            <div
              v-if="selected.description"
              class="q-mb-md"
              style="font-size: 0.85rem; color: var(--ax-text-muted); line-height: 1.5"
            >
              {{ selected.description }}
            </div>

            <!-- Meta badges -->
            <div class="q-mb-md" style="display: flex; flex-wrap: wrap; gap: 6px">
              <span class="ax-badge" :class="'ax-badge--' + sensitivityVariant(selected.sensitivity)">
                <q-icon name="security" size="12px" />
                {{ selected.sensitivity }}
              </span>
              <span
                v-for="p in selected.requiredProof || []"
                :key="p"
                class="ax-badge ax-badge--accent"
              >
                <q-icon name="shield" size="12px" />
                {{ p }}
              </span>
              <span v-if="selected.deprecated" class="ax-badge ax-badge--warning">
                <q-icon name="warning" size="12px" />
                Deprecated
              </span>
            </div>

            <!-- Contract / limits -->
            <div v-if="selected.contract" class="row q-col-gutter-sm q-mb-md">
              <div class="col-6 col-sm-3">
                <div class="ax-stat-card">
                  <div class="ax-stat-label">Max DB writes</div>
                  <div class="ax-stat-value font-mono">
                    {{ selected.contract.maxDbWrites ?? '—' }}
                  </div>
                </div>
              </div>
              <div class="col-6 col-sm-3">
                <div class="ax-stat-card">
                  <div class="ax-stat-label">Max time</div>
                  <div class="ax-stat-value font-mono">
                    {{ selected.contract.maxTimeMs != null ? selected.contract.maxTimeMs + ' ms' : '—' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- JSON Schema viewer -->
            <div v-if="hasSchema">
              <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-text-dim); margin-bottom: 6px; margin-left: 2px">
                Schema
              </div>
              <JsonTree
                :value="selected.schema || selected.inputSchema || null"
                max-height="280px"
                :max-depth="2"
              />
            </div>

            <!-- Examples -->
            <div v-if="selected.examples?.length" class="q-mt-md">
              <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-text-dim); margin-bottom: 6px; margin-left: 2px">
                Examples
              </div>
              <div class="response-hex font-mono">{{ selected.examples.join('\n') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import JsonTree from 'src/components/JsonTree.vue';
import { fetchCatalog } from 'src/services/axis-client';

interface IntentDef {
  intent: string;
  description: string;
  sensitivity: string;
  requiredProof?: string[];
  contract?: { maxDbWrites?: number; maxTimeMs?: number };
  examples?: string[];
  schema?: unknown;
  inputSchema?: unknown;
  deprecated?: boolean;
}

const router   = useRouter();
const intents  = ref<IntentDef[]>([]);
const selected = ref<IntentDef | null>(null);
const search   = ref('');
const loading  = ref(false);

const filteredIntents = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return intents.value;
  return intents.value.filter(
    (i) =>
      i.intent.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q),
  );
});

const hasSchema = computed(
  () => selected.value?.schema || selected.value?.inputSchema,
);

function sensitivityVariant(s: string): string {
  switch (s) {
    case 'LOW':      return 'success';
    case 'MEDIUM':   return 'info';
    case 'HIGH':     return 'warning';
    case 'CRITICAL': return 'error';
    default:         return 'neutral';
  }
}

async function loadCatalog() {
  loading.value = true;
  try {
    intents.value = await fetchCatalog();
  } finally {
    loading.value = false;
  }
}

function openInSender(intent: string) {
  router.push({ path: '/sender', query: { intent } });
}

loadCatalog();
</script>

<style scoped>
.registry-item {
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}
.registry-item--active {
  background: var(--ax-primary-soft) !important;
  border-left-color: var(--ax-primary) !important;
  color: var(--ax-primary) !important;
}
</style>
