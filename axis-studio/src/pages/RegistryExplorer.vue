<template>
  <div class="column q-gutter-y-sm">
    <section
      class="col-auto full-width registry-header row justify-between items-center"
    >
      <div>
        <div class="registry-eyebrow">Registry Service</div>
        <div class="text-h4">Intent Explorer</div>
        <p>
          Explore available AXIS intents and open any intent directly in Sender.
        </p>
      </div>
      <div class="registry-stats">
        <div class="registry-stat">
          <span>{{ intents.length }}</span>
          <small>Registered Intents</small>
        </div>
        <div class="registry-stat">
          <span>{{ latencyLabel }}</span>
          <small>Query Latency</small>
        </div>
      </div>
    </section>

    <section
      class="col-auto full-width row justify-between items-center q-gutter-x-sm"
    >
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Filter intents..."
        class="col"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <q-select
        v-model="selectedDomain"
        dense
        outlined
        clearable
        :options="domains"
        label="Domain"
        class="w-200 col"
      />

      <q-btn
        flat
        no-caps
        label="Reset"
        @click="resetFilters"
        class="col-auto"
      />
      <q-btn
        flat
        round
        dense
        icon="refresh"
        :loading="loading"
        title="Reload from server"
        @click="loadCatalog(true)"
        class="col-auto"
      />
    </section>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="32px" />
    </q-inner-loading>

    <section
      v-if="!loading && filteredIntents.length"
      class="col row justify-start items-center scroll-y"
    >
      <div
        v-for="item in filteredIntents"
        :key="item.intent"
        class="q-pa-xs col-3"
      >
        <q-card flat bordered class="fit registry-card">
          <q-card-section class="registry-card-head">
            <div>
              <q-badge color="primary" text-color="black">
                {{ item.intent.split(".").pop() }}
              </q-badge>
              <q-badge v-if="item.deprecated" color="negative" class="q-ml-sm">
                Deprecated
              </q-badge>
              <h3>{{ item.intent }}</h3>
            </div>
            <q-btn
              flat
              round
              dense
              icon="launch"
              @click="openInSender(item.intent)"
            />
          </q-card-section>

          <q-card-section>
            <p class="registry-card-desc">
              {{ item.description || "No description provided." }}
            </p>

            <div class="registry-card-meta">
              <div>
                <small>Proofs</small>
                <span>{{
                  (item.requiredProof || []).join(" / ") || "None"
                }}</span>
              </div>
              <div>
                <small>Schema</small>
                <span>{{ hasInputSchema(item) ? "Present" : "N/A" }}</span>
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="between">
            <div class="registry-tags">
              <q-badge
                v-for="tag in getTags(item)"
                :key="tag"
                color="grey-8"
                text-color="grey-3"
              >
                {{ tag }}
              </q-badge>
            </div>
            <q-btn
              unelevated
              color="primary"
              text-color="black"
              no-caps
              label="Open in Sender"
              @click="openInSender(item.intent)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </section>

    <section v-else class="col fit registry-empty">
      <q-icon name="search_off" size="40px" />
      <span>No intents match your filters</span>
      <q-btn flat no-caps label="Reset all filters" @click="resetFilters" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onActivated, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useConnectionStore } from "stores/connection";
import { useRegistryStore } from "stores/registry";

interface IntentDef {
  intent: string;
  description: string;
  sensitivity: string;
  requiredProof?: string[];
  contract?: { maxDbWrites?: number; maxTimeMs?: number };
  bodyProfile?: string;
  input?: unknown[];
  fields?: unknown[];
  examples?: string[];
  schema?: unknown;
  inputSchema?: unknown;
  deprecated?: boolean;
}

const route = useRoute();
const router = useRouter();
const conn = useConnectionStore();
const registry = useRegistryStore();
const { intents: storeIntents, loading } = storeToRefs(registry);
const intents = computed<IntentDef[]>(() => storeIntents.value as IntentDef[]);
const search = ref("");
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

function getTags(item: IntentDef): string[] {
  const tags: string[] = [];
  const domain = getDomain(item.intent).split(".").pop();
  if (domain) tags.push(domain);
  if (item.requiredProof?.length) tags.push(item.requiredProof[0]);
  return tags.slice(0, 2);
}

function hasInputSchema(item: IntentDef): boolean {
  return Boolean(
    item.input?.length ||
    item.fields?.length ||
    item.schema ||
    item.inputSchema ||
    item.bodyProfile,
  );
}

async function loadCatalog(force = false) {
  await registry.load(force);
}

function resetFilters() {
  selectedDomain.value = "";
  search.value = "";
}

function openInSender(intent: string) {
  router.push({ path: "/sender", query: { intent } });
}

function syncFromRoute() {
  const q = route.query.q;
  if (typeof q === "string" && q.trim()) {
    search.value = q.trim();
  }
}

onMounted(() => {
  syncFromRoute();
  void loadCatalog();
});

onActivated(() => {
  syncFromRoute();
  void loadCatalog();
});
</script>
