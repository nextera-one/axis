<template>
  <div class="ax-page" style="padding: 20px 24px; overflow-y: auto; height: 100%">

    <!-- ══════ HERO ══════════════════════════════════ -->
    <div style="margin-bottom: 20px">
      <h1 style="
        font-family: var(--ax-font-headline);
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--ax-on-surface);
        margin: 0 0 4px;
        letter-spacing: -0.02em;
      ">Intent Explorer</h1>
      <p style="
        font-family: var(--ax-font-mono);
        font-size: 0.7rem;
        color: var(--ax-outline);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
      ">
        {{ intents.length }} registered intents · {{ domainCount }} domains
      </p>
    </div>

    <!-- ══════ TOP BAR ═══════════════════════════════ -->
    <div style="
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    ">
      <q-input
        v-model="search"
        placeholder="Search intents…"
        outlined dense clearable
        style="flex: 1; max-width: 400px"
      >
        <template #prepend>
          <span class="material-symbols-outlined" style="font-size: 18px; color: var(--ax-outline)">search</span>
        </template>
      </q-input>

      <q-btn
        flat dense no-caps
        label="Refresh"
        icon="refresh"
        :loading="loading"
        style="color: var(--ax-primary); font-family: var(--ax-font-mono); font-size: 0.72rem; letter-spacing: 0.04em"
        @click="loadCatalog"
      />

      <q-space />

      <span
        class="ax-badge ax-badge--ok font-mono"
        style="font-size: 0.65rem"
      >
        <span class="ax-pulse-dot" style="width: 6px; height: 6px" />
        REGISTRY ONLINE
      </span>
    </div>

    <!-- ══════ MAIN GRID ═════════════════════════════ -->
    <div style="display: flex; gap: 16px; min-height: 0">

      <!-- DOMAIN CLUSTERS SIDEBAR -->
      <div style="
        width: 220px;
        flex-shrink: 0;
        background: var(--ax-surface);
        border-radius: 4px;
        border: 1px solid var(--ax-border);
        overflow-y: auto;
        max-height: calc(100vh - 240px);
      ">
        <div style="
          padding: 10px 12px 8px;
          font-family: var(--ax-font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--ax-outline);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 1px solid var(--ax-border);
        ">Domain Clusters</div>

        <div style="padding: 6px">
          <div
            v-for="d in domains"
            :key="d"
            class="ax-domain-item"
            :class="{ 'ax-domain-item--active': selectedDomain === d }"
            @click="selectedDomain = selectedDomain === d ? '' : d"
          >
            <span class="material-symbols-outlined" style="font-size: 15px">folder</span>
            <span>{{ d }}</span>
            <span style="
              margin-left: auto;
              font-size: 0.6rem;
              color: var(--ax-outline);
              font-family: var(--ax-font-mono);
            ">{{ domainCounts[d] || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- INTENT CARDS GRID -->
      <div style="flex: 1; min-width: 0">
        <div v-if="filteredIntents.length" class="ax-intent-grid">
          <div
            v-for="item in filteredIntents"
            :key="item.intent"
            class="ax-bento-card"
            :class="{ 'ax-bento-card--selected': selected?.intent === item.intent }"
            @click="selected = item"
          >
            <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px">
              <span class="font-mono" style="
                font-size: 0.78rem;
                font-weight: 600;
                color: var(--ax-on-surface);
                flex: 1;
                word-break: break-all;
              ">{{ item.intent }}</span>
              <span
                class="ax-badge font-mono"
                :class="'ax-badge--' + sensitivityVariant(item.sensitivity)"
                style="font-size: 0.55rem; flex-shrink: 0"
              >{{ item.sensitivity }}</span>
            </div>

            <p v-if="item.description" style="
              font-size: 0.72rem;
              color: var(--ax-on-surface-variant);
              margin: 0 0 10px;
              line-height: 1.4;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            ">{{ item.description }}</p>

            <div style="display: flex; align-items: center; gap: 6px; margin-top: auto">
              <span
                v-for="p in (item.requiredProof || []).slice(0, 2)"
                :key="p"
                class="ax-chip font-mono"
                style="font-size: 0.58rem"
              >{{ p }}</span>
              <q-space />
              <q-btn
                flat dense no-caps size="xs"
                label="Open in Sender"
                style="color: var(--ax-primary); font-family: var(--ax-font-mono); font-size: 0.6rem"
                @click.stop="openInSender(item.intent)"
              />
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="ax-empty" style="padding: 60px 20px">
          <span class="material-symbols-outlined ax-empty-icon" style="font-size: 36px">search_off</span>
          <div class="ax-empty-text">
            {{ intents.length ? 'No intents match your search' : 'Click Refresh to load the catalog' }}
          </div>
        </div>
      </div>

      <!-- DETAIL SIDE PANEL -->
      <div
        v-if="selected"
        style="
          width: 340px;
          flex-shrink: 0;
          background: var(--ax-surface);
          border-radius: 4px;
          border: 1px solid var(--ax-border);
          overflow-y: auto;
          max-height: calc(100vh - 240px);
        "
      >
        <div style="
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--ax-border);
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--ax-primary)">info</span>
          <span class="font-mono" style="
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--ax-on-surface);
            flex: 1;
            word-break: break-all;
          ">{{ selected.intent }}</span>
          <q-btn
            flat dense round size="xs"
            icon="close"
            style="color: var(--ax-outline)"
            @click="selected = null"
          />
        </div>

        <div style="padding: 14px">
          <!-- Description -->
          <div
            v-if="selected.description"
            style="font-size: 0.8rem; color: var(--ax-on-surface-variant); line-height: 1.5; margin-bottom: 14px"
          >{{ selected.description }}</div>

          <!-- Meta badges -->
          <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 14px">
            <span class="ax-badge font-mono" :class="'ax-badge--' + sensitivityVariant(selected.sensitivity)">
              <span class="material-symbols-outlined" style="font-size: 12px">security</span>
              {{ selected.sensitivity }}
            </span>
            <span
              v-for="p in selected.requiredProof || []"
              :key="p"
              class="ax-badge ax-badge--accent font-mono"
            >{{ p }}</span>
            <span v-if="selected.deprecated" class="ax-badge ax-badge--warning font-mono">Deprecated</span>
          </div>

          <!-- Contract stats -->
          <div v-if="selected.contract" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px">
            <div class="ax-stat-card">
              <div class="ax-stat-label">Max DB writes</div>
              <div class="ax-stat-value font-mono">{{ selected.contract.maxDbWrites ?? '—' }}</div>
            </div>
            <div class="ax-stat-card">
              <div class="ax-stat-label">Max time</div>
              <div class="ax-stat-value font-mono">{{ selected.contract.maxTimeMs != null ? selected.contract.maxTimeMs + ' ms' : '—' }}</div>
            </div>
          </div>

          <!-- Schema viewer -->
          <div v-if="hasSchema">
            <div style="
              font-family: var(--ax-font-mono);
              font-size: 0.65rem;
              font-weight: 700;
              color: var(--ax-outline);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 6px;
            ">Schema</div>
            <JsonTree
              :value="selected.schema || selected.inputSchema || null"
              max-height="220px"
              :max-depth="2"
            />
          </div>

          <!-- Open in Sender button -->
          <button
            class="ins-send-btn font-mono"
            style="width: 100%; margin-top: 16px"
            @click="openInSender(selected.intent)"
          >
            <span class="material-symbols-outlined" style="font-size: 14px">send</span>
            OPEN IN SENDER
          </button>
        </div>
      </div>
    </div>

  </div>
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
const selectedDomain = ref('');

const filteredIntents = computed(() => {
  let list = intents.value;
  if (selectedDomain.value) {
    list = list.filter(i => getDomain(i.intent) === selectedDomain.value);
  }
  const q = search.value.toLowerCase();
  if (q) {
    list = list.filter(
      i => i.intent.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
    );
  }
  return list;
});

const hasSchema = computed(
  () => selected.value?.schema || selected.value?.inputSchema,
);

function getDomain(intent: string): string {
  const parts = intent.split('.');
  return parts.length >= 2 ? parts.slice(0, -1).join('.') : 'other';
}

const domains = computed(() => {
  const set = new Set<string>();
  intents.value.forEach(i => set.add(getDomain(i.intent)));
  return [...set].sort();
});

const domainCounts = computed(() => {
  const counts: Record<string, number> = {};
  intents.value.forEach(i => {
    const d = getDomain(i.intent);
    counts[d] = (counts[d] || 0) + 1;
  });
  return counts;
});

const domainCount = computed(() => domains.value.length);

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
</script>

<style scoped>
.ax-intent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.ax-domain-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 3px;
  font-family: var(--ax-font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ax-on-surface-variant);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ax-domain-item:hover {
  background: var(--ax-surface-low);
}
.ax-domain-item--active {
  background: var(--ax-surface-low);
  color: var(--ax-primary);
}
</style>
