<template>
  <q-page class="ax-page q-pa-md">
    <div class="row q-col-gutter-md">

      <!-- ══════ REQUEST PANEL ════════════════════════════════════════════ -->
      <div class="col-12 col-lg-5">
        <div class="ax-panel ax-panel-accent" style="position: relative">
          <div class="ax-panel-header row items-center">
            <q-icon name="send" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title">Request</span>
            <q-space />
            <q-btn
              flat dense round size="xs"
              icon="backspace"
              title="Clear form"
              @click="clearForm"
            />
          </div>

          <div class="q-pa-md">
            <!-- Intent selector -->
            <q-select
              v-model="intent"
              :options="filteredOpts"
              use-input
              fill-input
              hide-selected
              input-debounce="80"
              label="Intent"
              outlined
              dense
              new-value-mode="add-unique"
              class="q-mb-sm"
              @filter="filterIntents"
            >
              <template #prepend>
                <q-icon name="chevron_right" style="color: var(--ax-primary)" />
              </template>
              <template #selected-item="{ opt }">
                <span class="font-mono">{{ opt }}</span>
              </template>
              <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps" dense>
                  <q-item-section>
                    <q-item-label class="font-mono" style="font-size: 0.78rem">{{ opt }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item dense>
                  <q-item-section style="font-size: 0.78rem; color: var(--ax-text-dim)">
                    Type an intent name and press Enter
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Quick picks -->
            <div class="q-mb-md" style="display: flex; flex-wrap: wrap; gap: 6px">
              <span
                v-for="q in quickPicks"
                :key="q"
                class="ax-chip font-mono"
                @click="intent = q"
              >
                {{ q }}
              </span>
            </div>

            <!-- Body JSON editor -->
            <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-text-dim); margin-bottom: 6px; margin-left: 2px">
              Body (JSON)
            </div>
            <JsonEditor
              v-model="bodyText"
              min-height="180px"
              class="q-mb-md"
              :show-line-numbers="true"
            />

            <!-- Context row -->
            <div class="row items-center q-mb-md" style="gap: 6px">
              <span class="ax-badge ax-badge--neutral font-mono" style="font-size: 0.68rem">
                <q-icon name="person" size="12px" />
                {{ auth.actorId || 'anonymous' }}
              </span>
              <span
                v-if="auth.capsuleId"
                class="ax-badge ax-badge--accent font-mono"
                style="font-size: 0.68rem"
              >
                <q-icon name="inventory_2" size="12px" />
                {{ auth.capsuleId }}
              </span>
            </div>

            <!-- Send button -->
            <q-btn
              unelevated
              icon="send"
              label="Send Intent"
              :loading="sending"
              :disable="!intent"
              class="full-width ax-btn-primary"
              style="height: 42px; font-size: 0.85rem"
              @click="send"
            />
          </div>
        </div>
      </div>

      <!-- ══════ RESPONSE PANEL ═══════════════════════════════════════════ -->
      <div class="col-12 col-lg-7">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center no-wrap">
            <q-icon name="inbox" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title q-mr-auto">Response</span>

            <template v-if="lastResult">
              <span
                class="ax-badge font-mono q-mr-xs"
                :class="lastResult.ok ? 'ax-badge--success' : 'ax-badge--error'"
              >
                {{ lastResult.status }}
              </span>
              <span class="ax-badge ax-badge--info font-mono q-mr-xs">
                {{ lastResult.durationMs }}ms
              </span>
              <span
                v-if="lastResult.effect"
                class="ax-badge ax-badge--accent font-mono"
              >
                {{ lastResult.effect }}
              </span>
            </template>
          </div>

          <!-- Tabs: JSON Tree | Raw -->
          <q-tabs
            v-model="viewTab"
            dense
            align="left"
            class="ax-tabs q-px-sm"
            :active-color="$q.dark.isActive ? 'cyan-3' : 'primary'"
            indicator-color="primary"
          >
            <q-tab name="tree" icon="account_tree" label="Tree" />
            <q-tab name="raw"  icon="code"         label="Raw" />
          </q-tabs>

          <q-separator />

          <q-tab-panels
            v-model="viewTab"
            animated
            class="transparent-panels"
          >
            <!-- JSON Tree -->
            <q-tab-panel name="tree" class="q-pa-none">
              <JsonTree
                :value="lastResult?.response"
                max-height="520px"
                :empty-text="sending ? 'Waiting for response…' : 'Send an intent to see the response'"
              />
            </q-tab-panel>

            <!-- Raw -->
            <q-tab-panel name="raw" class="q-pa-none">
              <div v-if="lastResult" class="ax-raw-viewer font-mono">{{ lastResult.raw }}</div>
              <div v-else class="ax-empty">
                <q-icon name="code" class="ax-empty-icon" />
                <div class="ax-empty-text">No raw data yet</div>
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </div>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import JsonEditor from 'src/components/JsonEditor.vue';
import JsonTree   from 'src/components/JsonTree.vue';
import { sendIntent, fetchCatalog, type SendResult } from 'src/services/axis-client';
import { useAuthStore } from 'stores/auth';

const $q    = useQuasar();
const route = useRoute();
const auth  = useAuthStore();

const intent     = ref<string>('catalog.list');
const bodyText   = ref('{\n  \n}');
const sending    = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewTab    = ref<'tree' | 'raw'>('tree');

const quickPicks = [
  'catalog.list',
  'catalog.describe',
  'catalog.search',
  'axis.sessions.list',
  'axis.identities.list',
  'axis.capsules.list',
];

/* ── Autocomplete ──────────────────────────────────────── */
const allOpts      = ref<string[]>([...quickPicks]);
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
  } catch { /* fallback to quickPicks */ }

  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

/* ── Actions ───────────────────────────────────────────── */
function clearForm() {
  intent.value     = '';
  bodyText.value   = '{\n  \n}';
  lastResult.value = null;
}

async function send() {
  if (!intent.value) return;
  sending.value = true;
  try {
    let body: Record<string, unknown> = {};
    const trimmed = bodyText.value.trim();
    if (trimmed && trimmed !== '{}') {
      body = JSON.parse(trimmed);
    }
    lastResult.value = await sendIntent(intent.value, body);
    viewTab.value    = 'tree';
  } catch (e: any) {
    lastResult.value = {
      ok: false, status: 0, durationMs: 0,
      response: { error: e.message },
      raw: e.message, effect: 'PARSE_ERROR',
    };
    $q.notify({ message: e.message, color: 'negative', icon: 'error', timeout: 3000 });
  } finally {
    sending.value = false;
  }
}
</script>
