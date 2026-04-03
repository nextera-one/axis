<template>
  <div class="sender-page">
    <section class="sender-toolbar">
      <div class="sender-intent-row">
        <q-select
          v-model="intent"
          :options="filteredOpts"
          use-input
          fill-input
          hide-selected
          input-debounce="80"
          new-value-mode="add-unique"
          outlined
          dense
          class="sender-intent-select"
          placeholder="intent.name"
          @filter="filterIntents"
        />

        <q-btn
          unelevated
          color="primary"
          :loading="sending"
          :disable="!intent || sending"
          label="Execute"
          @click="send"
        />

        <q-btn flat round icon="restart_alt" @click="clearForm" />
      </div>

      <div class="sender-quick-picks">
        <q-btn
          v-for="q in quickPicks"
          :key="q"
          flat
          dense
          no-caps
          class="sender-chip"
          :label="q"
          @click="intent = q"
        />
      </div>
    </section>

    <q-splitter v-model="splitterModel" class="sender-splitter">
      <template #before>
        <div class="sender-panel">
          <q-tabs
            v-model="reqTab"
            dense
            align="left"
            indicator-color="primary"
            class="sender-tabs"
          >
            <q-tab name="body" label="Body" />
            <q-tab name="context" label="Context" />
            <q-tab name="auth" label="Auth" />
          </q-tabs>

          <q-tab-panels v-model="reqTab" animated class="sender-panels">
            <q-tab-panel name="body" class="sender-tab-panel sender-tab-panel--editor">
              <JsonEditor
                v-model="bodyText"
                class="sender-editor"
                :show-line-numbers="true"
              />
              <div class="sender-editor-status">
                <span>Dispatch using Execute</span>
                <span>Size: {{ bodyByteSize }}</span>
              </div>
            </q-tab-panel>

            <q-tab-panel name="context" class="sender-tab-panel">
              <q-card flat bordered class="sender-info-card">
                <q-card-section>
                  <div class="sender-info-label">Actor ID</div>
                  <div class="sender-info-value">{{ auth.actorId || 'studio:anonymous' }}</div>
                </q-card-section>
                <q-separator />
                <q-card-section>
                  <div class="sender-info-label">Capsule ID</div>
                  <div class="sender-info-value">{{ auth.capsuleId || 'None' }}</div>
                </q-card-section>
                <q-separator />
                <q-card-section>
                  <router-link to="/auth" class="sender-link">
                    Modify signing context
                  </router-link>
                </q-card-section>
              </q-card>
            </q-tab-panel>

            <q-tab-panel name="auth" class="sender-tab-panel">
              <q-card flat bordered class="sender-info-card">
                <q-card-section>
                  <div class="sender-info-label">Active Proof Type</div>
                  <div class="sender-info-value">CAPSULE_BINDING_V1</div>
                </q-card-section>
                <q-separator />
                <q-card-section class="sender-note">
                  Outbound frames are signed locally when an active key exists.
                </q-card-section>
              </q-card>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </template>

      <template #after>
        <div class="sender-panel">
          <div class="sender-result-head">
            <q-tabs
              v-model="viewTab"
              dense
              align="left"
              indicator-color="primary"
              class="sender-tabs"
            >
              <q-tab name="tree" label="Preview" />
              <q-tab name="raw" label="Raw" />
            </q-tabs>

            <div v-if="lastResult" class="sender-result-meta">
              <span :class="lastResult.ok ? 'text-positive' : 'text-negative'">
                {{ lastResult.ok ? '200 OK' : 'ERR ' + lastResult.status }}
              </span>
              <span>{{ lastResult.durationMs }}ms</span>
            </div>
          </div>

          <q-tab-panels v-model="viewTab" animated class="sender-panels">
            <q-tab-panel name="tree" class="sender-tab-panel sender-tab-panel--result">
              <JsonTree
                v-if="lastResult?.response !== undefined && lastResult?.response !== null"
                :value="lastResult.response"
                class="sender-tree"
                :max-height="'100%'"
              />
              <div v-else class="sender-empty">
                <q-icon name="terminal" size="48px" />
                <span>{{ sending ? 'Intercepting frame…' : 'Idle - awaiting intent' }}</span>
              </div>
            </q-tab-panel>

            <q-tab-panel name="raw" class="sender-tab-panel sender-tab-panel--result">
              <pre v-if="lastResult" class="sender-raw">{{ lastResult.raw }}</pre>
              <div v-else class="sender-empty">
                <q-icon name="analytics" size="48px" />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </template>
    </q-splitter>

    <section v-if="lastResult?.effect" class="sender-effect-bar">
      <div class="sender-effect-meta">
        <span class="sender-info-label">Protocol Effect</span>
        <q-badge color="primary" text-color="black">{{ lastResult.effect }}</q-badge>
      </div>
      <q-btn
        flat
        dense
        no-caps
        label="View Receipt Chain"
        @click="router.push({ path: '/history', query: { intent: intent } })"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import JsonEditor from 'src/components/JsonEditor.vue';
import JsonTree from 'src/components/JsonTree.vue';
import {
  sendIntent,
  fetchCatalog,
  type SendResult,
} from 'src/services/axis-client';
import { useAuthStore } from 'stores/auth';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const intent = ref<string>('catalog.list');
const bodyText = ref('{\n  \n}');
const sending = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewTab = ref<'tree' | 'raw'>('tree');
const reqTab = ref<'body' | 'context' | 'auth'>('body');
const splitterModel = ref(44);

const quickPicks = [
  'catalog.list',
  'catalog.describe',
  'catalog.search',
  'axis.sessions.list',
  'axis.identities.list',
  'axis.capsules.list',
];

const allOpts = ref<string[]>([...quickPicks]);
const filteredOpts = ref<string[]>([...quickPicks]);

function filterIntents(val: string, update: (fn: () => void) => void) {
  update(() => {
    const q = val.toLowerCase();
    filteredOpts.value = q
      ? allOpts.value.filter((i) => i.toLowerCase().includes(q)).slice(0, 60)
      : allOpts.value.slice(0, 60);
  });
}

onMounted(async () => {
  try {
    const catalog = await fetchCatalog();
    allOpts.value = catalog.map((i) => i.intent);
    filteredOpts.value = allOpts.value.slice(0, 60);
  } catch {
    /* fallback to quick picks */
  }

  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

const bodyByteSize = computed(() => {
  const bytes = new TextEncoder().encode(bodyText.value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
});

function clearForm() {
  intent.value = '';
  bodyText.value = '{\n  \n}';
  lastResult.value = null;
}

async function send() {
  if (!intent.value) return;
  sending.value = true;
  try {
    let body: unknown = {};
    const trimmed = bodyText.value.trim();
    if (trimmed && trimmed !== '{}') {
      body = JSON.parse(trimmed);
    }

    let payload = body;
    if (intent.value === 'catalog.search' && body && typeof body === 'object') {
      payload = String((body as Record<string, unknown>).query ?? '');
    }
    if (intent.value === 'catalog.describe' && body && typeof body === 'object') {
      payload = String((body as Record<string, unknown>).intent ?? '');
    }

    lastResult.value = await sendIntent(intent.value, payload);
    viewTab.value = 'tree';
  } catch (e: any) {
    lastResult.value = {
      ok: false,
      status: 0,
      durationMs: 0,
      response: { error: e.message },
      raw: e.message,
      effect: 'PARSE_ERROR',
    };
    $q.notify({
      message: e.message,
      color: 'negative',
      icon: 'error',
      timeout: 3000,
    });
  } finally {
    sending.value = false;
  }
}
</script>
