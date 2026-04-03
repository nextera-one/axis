<template>
  <div class="p-8">
    <!-- Hero Section / Asymmetric Header -->
    <div class="grid grid-cols-12 gap-8 py-12 items-end">
      <div class="col-span-8">
        <div class="flex items-center gap-2 mb-2">
          <div
            class="w-1 h-1 bg-primary-container shadow-[0_0_8px_#00F5FF]"
          ></div>
          <span
            class="font-mono text-[10px] text-primary-container tracking-widest uppercase"
            >Registry Service v4.0</span
          >
        </div>
        <h1
          class="font-headline text-5xl font-black text-on-surface tracking-tighter leading-none mb-4 uppercase"
        >
          Intent Explorer
        </h1>
        <p
          class="text-on-surface-variant text-sm max-w-xl leading-relaxed opacity-70"
        >
          Access the decentralized catalog of cryptographic intents. Navigate
          through verified domains, audit schema requirements, and execute
          protocol-grade operations with deterministic precision.
        </p>
      </div>
      <div class="col-span-4 flex justify-end gap-12">
        <div class="text-right">
          <div class="font-mono text-2xl font-bold text-on-surface">
            {{ intents.length }}
          </div>
          <div
            class="font-mono text-[9px] uppercase tracking-tighter text-on-surface-variant/40"
          >
            Registered Intents
          </div>
        </div>
        <div class="text-right">
          <div class="font-mono text-2xl font-bold text-primary-container">
            {{ latencyLabel }}
          </div>
          <div
            class="font-mono text-[9px] uppercase tracking-tighter text-on-surface-variant/40"
          >
            Query Latency
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-12 gap-8">
      <!-- Sidebar Filters -->
      <aside class="col-span-3 space-y-8">
        <section>
          <h3
            class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest mb-4 flex items-center gap-2"
          >
            <span class="w-4 h-px bg-on-surface-variant/20"></span> Search
          </h3>
          <div class="relative">
            <span
              class="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/40 scale-75"
              >search</span
            >
            <input
              v-model="search"
              class="w-full bg-surface-container-low border border-white/5 pl-8 pr-3 py-2 text-xs font-mono text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary-container/30 focus:outline-none"
              placeholder="Filter intents..."
              type="text"
            />
          </div>
        </section>

        <section>
          <h3
            class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest mb-4 flex items-center gap-2"
          >
            <span class="w-4 h-px bg-on-surface-variant/20"></span> Domain
            Clusters
          </h3>
          <ul class="space-y-1">
            <li v-for="d in domains" :key="d">
              <button
                class="w-full text-left px-3 py-2 text-xs font-mono transition-colors flex justify-between items-center group"
                :class="
                  selectedDomain === d
                    ? 'bg-surface-container-low text-primary-container border-l border-primary-container'
                    : 'text-on-surface-variant/60 hover:bg-surface-container/50 hover:text-on-surface'
                "
                @click="selectedDomain = selectedDomain === d ? '' : d"
              >
                <span>{{ d }}</span>
                <span class="text-[9px] opacity-40">{{
                  domainCounts[d] || 0
                }}</span>
              </button>
            </li>
          </ul>
        </section>

        <div
          class="p-4 bg-surface-container-low/50 border border-white/5 space-y-4"
        >
          <div class="flex items-center justify-between">
            <span
              class="font-mono text-[9px] text-on-surface-variant/40 uppercase"
              >System Integrity</span
            >
            <div class="flex gap-1">
              <div class="w-1 h-3 bg-primary-container/20"></div>
              <div class="w-1 h-3 bg-primary-container/40"></div>
              <div class="w-1 h-3 bg-primary-container/60"></div>
              <div class="w-1 h-3 bg-primary-container"></div>
            </div>
          </div>
          <p
            class="text-[10px] text-on-surface-variant/60 font-mono leading-tight"
          >
            All registry entries are cryptographically signed by authorized AXIS
            nodes.
          </p>
        </div>
      </aside>

      <!-- Grid of Intent Cards -->
      <div class="col-span-9">
        <div class="grid grid-cols-2 gap-4">
          <article
            v-for="item in filteredIntents"
            :key="item.intent"
            class="bg-surface-container p-6 relative overflow-hidden group transition-all hover:bg-surface-container-high border-l-2 border-primary-container/20 hover:border-primary-container"
          >
            <div
              class="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 -rotate-45 translate-x-16 -translate-y-16"
            ></div>

            <div class="flex justify-between items-start mb-6 relative z-10">
              <div class="min-w-0">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    class="font-mono text-[9px] bg-primary-container/10 text-primary-container px-2 py-0.5"
                    >{{ item.intent.split(".").pop() }}</span
                  >
                  <span
                    class="font-mono text-[9px] text-on-surface-variant/40 uppercase"
                    >{{ item.sensitivity }}</span
                  >
                  <span
                    v-if="item.deprecated"
                    class="font-mono text-[9px] bg-error-container/20 text-error px-2 py-0.5"
                    >DEPRECATED</span
                  >
                </div>
                <h3
                  class="font-headline text-lg font-bold tracking-tight text-on-surface leading-tight break-all"
                >
                  {{ item.intent }}
                </h3>
              </div>
              <span
                class="material-symbols-outlined text-on-surface-variant/40 scale-75 cursor-pointer hover:text-primary-container transition-colors"
                @click="openInSender(item.intent)"
                >launch</span
              >
            </div>

            <p
              class="text-on-surface-variant text-xs mb-6 opacity-80 line-clamp-2 min-h-[32px]"
            >
              {{ item.description || "No description provided." }}
            </p>

            <div
              class="grid grid-cols-2 gap-x-4 gap-y-2 relative z-10 border-t border-white/5 pt-4"
            >
              <div class="space-y-1">
                <div
                  class="font-mono text-[8px] uppercase text-on-surface-variant/40"
                >
                  Proofs
                </div>
                <div class="text-[10px] font-mono text-on-surface truncate">
                  {{ (item.requiredProof || []).join(" / ") || "None" }}
                </div>
              </div>
              <div class="space-y-1">
                <div
                  class="font-mono text-[8px] uppercase text-on-surface-variant/40"
                >
                  Schema
                </div>
                <div class="text-[10px] font-mono text-on-surface truncate">
                  {{ item.schema ? "Present" : "N/A" }}
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-between items-center relative z-10">
              <div class="flex gap-2">
                <span
                  v-for="tag in getTags(item)"
                  :key="tag"
                  class="text-[9px] font-mono px-2 py-0.5 bg-surface-container-low text-on-surface-variant/60 uppercase"
                >
                  {{ tag }}
                </span>
              </div>
              <button
                class="bg-primary-container text-on-primary-fixed px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                @click="openInSender(item.intent)"
              >
                Open in Sender
              </button>
            </div>
          </article>
        </div>

        <!-- Empty state -->
        <div
          v-if="!filteredIntents.length"
          class="py-20 text-center border border-white/5 bg-surface-container-low/30"
        >
          <span
            class="material-symbols-outlined text-4xl text-on-surface-variant/20 mb-4"
            >search_off</span
          >
          <p class="font-mono text-sm text-on-surface-variant/50">
            NO INTENTS MATCH YOUR FILTERS
          </p>
          <button
            class="mt-4 px-6 py-2 bg-surface-container-high text-xs font-mono hover:text-primary-container transition-colors"
            @click="resetFilters"
          >
            RESET ALL FILTERS
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchCatalog } from "src/services/axis-client";
import { useConnectionStore } from "stores/connection";

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

const route = useRoute();
const router = useRouter();
const conn = useConnectionStore();
const intents = ref<IntentDef[]>([]);
const search = ref("");
const loading = ref(false);
const selectedDomain = ref("");

const latencyLabel = computed(() => {
  return conn.latencyMs != null ? `${conn.latencyMs}ms` : "—";
});

const filteredIntents = computed(() => {
  let list = intents.value;
  if (selectedDomain.value) {
    list = list.filter((i) => getDomain(i.intent) === selectedDomain.value);
  }
  const q = search.value.toLowerCase();
  if (q) {
    list = list.filter(
      (i) =>
        i.intent.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
  }
  return list;
});

function getDomain(intent: string): string {
  const parts = intent.split(".");
  return parts.length >= 2 ? parts.slice(0, -1).join(".") : "other";
}

const domains = computed(() => {
  const set = new Set<string>();
  intents.value.forEach((i) => set.add(getDomain(i.intent)));
  return [...set].sort();
});

const domainCounts = computed(() => {
  const counts: Record<string, number> = {};
  intents.value.forEach((i) => {
    const d = getDomain(i.intent);
    counts[d] = (counts[d] || 0) + 1;
  });
  return counts;
});

function getTags(item: IntentDef): string[] {
  const tags: string[] = [];
  const domain = getDomain(item.intent).split(".").pop();
  if (domain) tags.push(domain);
  if (item.requiredProof?.length) tags.push(item.requiredProof[0]);
  return tags.slice(0, 2);
}

async function loadCatalog() {
  loading.value = true;
  try {
    intents.value = await fetchCatalog();
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  selectedDomain.value = "";
  search.value = "";
}

function openInSender(intent: string) {
  router.push({ path: "/sender", query: { intent } });
}

onMounted(() => {
  const q = route.query.q;
  if (typeof q === "string" && q.trim()) {
    search.value = q.trim();
  }
  loadCatalog();
});
</script>

<style scoped>
/* Any additional specific styles for this page */
</style>
