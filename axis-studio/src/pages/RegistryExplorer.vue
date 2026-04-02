<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <!-- Left: Intent list -->
      <div class="col-12 col-md-5">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">Registry Explorer</div>
            <q-input
              v-model="search"
              label="Search intents…"
              dense
              outlined
              dark
              clearable
              class="q-mb-md"
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>

            <q-btn
              flat
              dense
              color="primary"
              icon="refresh"
              label="Fetch Catalog"
              :loading="loading"
              @click="loadCatalog"
              class="q-mb-sm"
            />

            <q-list separator dense>
              <q-item
                v-for="item in filteredIntents"
                :key="item.intent"
                clickable
                v-ripple
                :active="selected?.intent === item.intent"
                active-class="text-primary bg-grey-10"
                @click="selected = item"
              >
                <q-item-section>
                  <q-item-label class="font-mono text-caption">{{
                    item.intent
                  }}</q-item-label>
                  <q-item-label caption>{{
                    item.description || '—'
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="sensitivityColor(item.sensitivity)"
                    :label="item.sensitivity"
                    dense
                  />
                </q-item-section>
              </q-item>

              <q-item v-if="!filteredIntents.length && !loading">
                <q-item-section class="text-grey-6 text-center">
                  {{
                    intents.length
                      ? 'No matches'
                      : 'Click "Fetch Catalog" to load intents'
                  }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- Right: Detail panel -->
      <div class="col-12 col-md-7">
        <q-card flat bordered class="bg-dark" v-if="selected">
          <q-card-section>
            <div class="text-h6 font-mono text-primary">
              {{ selected.intent }}
            </div>
            <div class="text-body2 text-grey-4 q-mt-xs">
              {{ selected.description || 'No description' }}
            </div>
          </q-card-section>

          <q-separator dark />

          <q-card-section>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-5">Sensitivity</div>
                <q-badge
                  :color="sensitivityColor(selected.sensitivity)"
                  :label="selected.sensitivity"
                />
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-5">Required Proof</div>
                <div>
                  <q-badge
                    v-for="p in selected.requiredProof || []"
                    :key="p"
                    color="accent"
                    text-color="white"
                    class="q-mr-xs"
                    :label="p"
                  />
                  <span
                    v-if="!selected.requiredProof?.length"
                    class="text-grey-6"
                    >None</span
                  >
                </div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-5">Max DB Writes</div>
                <div>{{ selected.contract?.maxDbWrites ?? '—' }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-5">Max Time (ms)</div>
                <div>{{ selected.contract?.maxTimeMs ?? '—' }}</div>
              </div>
            </div>
          </q-card-section>

          <q-separator dark v-if="selected.examples?.length" />

          <q-card-section v-if="selected.examples?.length">
            <div class="text-caption text-grey-5 q-mb-xs">Examples</div>
            <pre class="response-hex q-pa-sm">{{
              selected.examples.join('\n')
            }}</pre>
          </q-card-section>

          <q-card-actions>
            <q-btn
              flat
              color="primary"
              icon="send"
              label="Open in Sender"
              @click="openInSender(selected.intent)"
            />
          </q-card-actions>
        </q-card>

        <q-card flat bordered class="bg-dark" v-else>
          <q-card-section class="text-center text-grey-6 q-pa-xl">
            <q-icon name="menu_book" size="48px" class="q-mb-md" />
            <div>Select an intent from the list to see details</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { fetchCatalog } from 'src/services/axis-client';

interface IntentDef {
  intent: string;
  description: string;
  sensitivity: string;
  requiredProof: string[];
  contract: { maxDbWrites: number; maxTimeMs: number };
  examples?: string[];
  deprecated?: boolean;
}

const router = useRouter();
const intents = ref<IntentDef[]>([]);
const selected = ref<IntentDef | null>(null);
const search = ref('');
const loading = ref(false);

const filteredIntents = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return intents.value;
  return intents.value.filter(
    (i) =>
      i.intent.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q),
  );
});

function sensitivityColor(s: string) {
  switch (s) {
    case 'LOW':
      return 'positive';
    case 'MEDIUM':
      return 'info';
    case 'HIGH':
      return 'warning';
    case 'CRITICAL':
      return 'negative';
    default:
      return 'grey';
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
