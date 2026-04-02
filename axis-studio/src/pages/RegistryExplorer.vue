<template>
  <q-page class="ax-page q-pa-md">
    <div class="row q-col-gutter-md">

      <!-- ══════ INTENT LIST ═════════════════════════════════ -->
      <div class="col-12 col-md-4">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center">
            <q-icon name="menu_book" color="primary" size="15px" class="q-mr-xs" />
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
              outlined
              dense
              clearable
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
            <span
              class="text-caption"
              :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
            >
              {{ filteredIntents.length }} / {{ intents.length }} intents
            </span>
            <q-space />
            <q-chip
              v-if="loading"
              dense
              size="xs"
              color="primary"
              text-color="white"
            >
              <q-spinner size="10px" class="q-mr-xs" /> Loading
            </q-chip>
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
                  <q-item-label class="font-mono text-caption text-weight-medium">
                    {{ item.intent }}
                  </q-item-label>
                  <q-item-label
                    v-if="item.description"
                    caption
                    class="ellipsis"
                    style="max-width: 200px"
                  >
                    {{ item.description }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="sensitivityColor(item.sensitivity)"
                    style="font-size: 0.6rem"
                  >
                    {{ item.sensitivity }}
                  </q-badge>
                </q-item-section>
              </q-item>

              <!-- Empty state -->
              <q-item v-if="!filteredIntents.length && !loading">
                <q-item-section class="text-center q-pa-lg">
                  <q-icon
                    name="search_off"
                    size="28px"
                    :color="$q.dark.isActive ? 'grey-7' : 'grey-5'"
                    class="q-mb-xs"
                  />
                  <div
                    class="text-caption"
                    :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
                  >
                    {{
                      intents.length
                        ? 'No matches'
                        : 'Click refresh to load catalog'
                    }}
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>

      <!-- ══════ DETAIL PANEL ════════════════════════════════ -->
      <div class="col-12 col-md-8">

        <!-- No selection -->
        <div
          v-if="!selected"
          class="ax-panel column items-center justify-center"
          style="min-height: 300px"
        >
          <q-icon
            name="menu_book"
            size="52px"
            :color="$q.dark.isActive ? 'grey-8' : 'grey-4'"
            class="q-mb-md"
          />
          <div
            class="text-body2"
            :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
          >
            Select an intent to see its details
          </div>
        </div>

        <!-- Selected intent detail -->
        <div v-else class="ax-panel">
          <div class="ax-panel-header row items-center no-wrap">
            <q-icon name="info" color="primary" size="15px" class="q-mr-xs" />
            <span class="ax-panel-title font-mono q-mr-auto ellipsis">
              {{ selected.intent }}
            </span>
            <q-btn
              flat dense
              color="primary"
              icon="send"
              label="Open in Sender"
              size="sm"
              @click="openInSender(selected.intent)"
            />
          </div>

          <div class="q-pa-md">
            <!-- Description -->
            <div
              v-if="selected.description"
              class="text-body2 q-mb-md"
              :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'"
            >
              {{ selected.description }}
            </div>

            <!-- Meta badges -->
            <div class="row q-gutter-sm q-mb-md">
              <q-badge :color="sensitivityColor(selected.sensitivity)" class="q-pa-xs">
                <q-icon name="security" size="12px" class="q-mr-xs" />
                {{ selected.sensitivity }}
              </q-badge>
              <q-badge
                v-for="p in selected.requiredProof || []"
                :key="p"
                color="purple-8"
                class="q-pa-xs"
              >
                <q-icon name="shield" size="12px" class="q-mr-xs" />
                {{ p }}
              </q-badge>
              <q-badge
                v-if="selected.deprecated"
                color="warning"
                text-color="dark"
                class="q-pa-xs"
              >
                <q-icon name="warning" size="12px" class="q-mr-xs" />
                Deprecated
              </q-badge>
            </div>

            <!-- Contract / limits -->
            <div
              v-if="selected.contract"
              class="row q-col-gutter-sm q-mb-md"
            >
              <div class="col-6 col-sm-3">
                <div
                  class="ax-stat-card"
                  :class="$q.dark.isActive ? 'ax-stat-card--dark' : 'ax-stat-card--light'"
                >
                  <div class="ax-stat-label">Max DB writes</div>
                  <div class="ax-stat-value font-mono">
                    {{ selected.contract.maxDbWrites ?? '—' }}
                  </div>
                </div>
              </div>
              <div class="col-6 col-sm-3">
                <div
                  class="ax-stat-card"
                  :class="$q.dark.isActive ? 'ax-stat-card--dark' : 'ax-stat-card--light'"
                >
                  <div class="ax-stat-label">Max time</div>
                  <div class="ax-stat-value font-mono">
                    {{ selected.contract.maxTimeMs != null ? selected.contract.maxTimeMs + ' ms' : '—' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- JSON Schema viewer -->
            <div v-if="hasSchema">
              <div
                class="text-caption q-mb-xs q-ml-xs"
                :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
              >
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
              <div
                class="text-caption q-mb-xs q-ml-xs"
                :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
              >
                Examples
              </div>
              <div class="response-hex">{{ selected.examples.join('\n') }}</div>
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

function sensitivityColor(s: string) {
  switch (s) {
    case 'LOW':      return 'positive';
    case 'MEDIUM':   return 'info';
    case 'HIGH':     return 'warning';
    case 'CRITICAL': return 'negative';
    default:         return 'grey-7';
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

// Auto-load on mount
loadCatalog();
</script>

<style scoped>
.registry-item { transition: background 0.1s; }
.registry-item--active {
  background: rgba(0, 188, 212, 0.1) !important;
  color: #00bcd4 !important;
}
.ax-stat-card {
  border-radius: 6px;
  padding: 8px 12px;
}
.ax-stat-card--dark  { background: #1a1a30; }
.ax-stat-card--light { background: #f0f1f8; }
.ax-stat-label {
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ax-text-dim);
  margin-bottom: 2px;
}
.ax-stat-value { font-size: 1rem; font-weight: 600; }
</style>
