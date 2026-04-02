<template>
  <q-page class="ax-page--ide">

    <!-- ══════════════════════════════════════════════════════════
         URL BAR — Insomnia-style intent bar
         ══════════════════════════════════════════════════════════ -->
    <div style="
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--ax-border);
      background: var(--ax-surface);
      flex-shrink: 0;
    ">

      <!-- URL bar row -->
      <div style="display: flex; align-items: center; gap: 8px">

        <!-- Method / type badge -->
        <div class="ins-url-bar" style="flex: 1">
          <div class="ins-url-method">
            <span class="ax-method ax-method--axis">AXIS</span>
            <q-icon name="arrow_drop_down" size="14px" style="color: var(--ax-text-dim)" />
          </div>

          <!-- Intent autocomplete -->
          <q-select
            v-model="intent"
            :options="filteredOpts"
            use-input
            fill-input
            hide-selected
            input-debounce="80"
            new-value-mode="add-unique"
            borderless
            dense
            hide-bottom-space
            class="ins-select"
            input-class="font-mono"
            popup-content-class="ins-popup"
            placeholder="intent.name"
            @filter="filterIntents"
          >
            <template #selected-item="{ opt }">
              <span class="font-mono" style="font-size: 0.83rem; color: var(--ax-primary)">{{ opt }}</span>
            </template>
            <template #option="{ itemProps, opt }">
              <q-item v-bind="itemProps" dense style="min-height: 30px">
                <q-item-section>
                  <q-item-label
                    class="font-mono"
                    style="font-size: 0.77rem; color: var(--ax-text)"
                  >{{ opt }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item dense>
                <q-item-section style="font-size: 0.75rem; color: var(--ax-text-dim)">
                  Type intent name and press Enter
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Send button -->
          <button
            class="ins-send-btn font-mono"
            :disabled="!intent || sending"
            @click="send"
          >
            <q-spinner v-if="sending" size="13px" color="white" />
            <q-icon v-else name="send" size="13px" />
            {{ sending ? 'Sending…' : 'Send' }}
          </button>
        </div>

        <!-- Clear button -->
        <q-btn
          flat dense round size="sm"
          icon="backspace"
          title="Clear"
          style="color: var(--ax-text-dim)"
          @click="clearForm"
        />
      </div>

      <!-- Quick picks -->
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px">
        <span
          v-for="q in quickPicks"
          :key="q"
          class="ax-chip font-mono"
          @click="intent = q"
        >{{ q }}</span>
      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════════
         MAIN SPLIT — request (left) + response (right)
         ══════════════════════════════════════════════════════════ -->
    <div style="display: flex; flex: 1; overflow: hidden; min-height: 0">

      <!-- ── REQUEST PANE ──────────────────────────────────────── -->
      <div style="
        width: 44%;
        min-width: 280px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--ax-border);
        overflow: hidden;
      ">

        <!-- Tabs -->
        <q-tabs
          v-model="reqTab"
          dense
          align="left"
          class="ins-tabs"
          :active-color="$q.dark.isActive ? 'white' : 'primary'"
          indicator-color="primary"
          style="flex-shrink: 0"
        >
          <q-tab name="body"    label="Body"    no-caps />
          <q-tab name="context" label="Context" no-caps />
        </q-tabs>

        <q-tab-panels
          v-model="reqTab"
          animated
          class="transparent-panels"
          style="flex: 1; overflow: hidden; min-height: 0; display: flex; flex-direction: column"
        >
          <!-- Body tab -->
          <q-tab-panel name="body" class="q-pa-none" style="display: flex; flex-direction: column; height: 100%">
            <JsonEditor
              v-model="bodyText"
              style="flex: 1; min-height: 0"
              :show-line-numbers="true"
            />
            <div class="ins-status-bar">
              <span class="ins-status-meta">Ctrl+Enter to send</span>
              <span class="ins-status-sep">·</span>
              <span class="ins-status-meta">{{ bodyByteSize }}</span>
            </div>
          </q-tab-panel>

          <!-- Context tab -->
          <q-tab-panel name="context" class="q-pa-sm" style="overflow-y: auto">
            <div class="q-mb-sm">
              <div style="
                font-size: 0.67rem;
                font-weight: 700;
                color: var(--ax-text-dim);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                margin-bottom: 5px;
              ">Actor Identity</div>
              <div class="ax-key-box">{{ auth.actorId || 'anonymous' }}</div>
            </div>

            <div v-if="auth.capsuleId" class="q-mb-sm">
              <div style="
                font-size: 0.67rem;
                font-weight: 700;
                color: var(--ax-text-dim);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                margin-bottom: 5px;
              ">Capsule ID</div>
              <div class="ax-key-box">{{ auth.capsuleId }}</div>
            </div>

            <q-btn
              flat dense no-caps size="sm"
              icon="vpn_key"
              label="Manage Keys"
              to="/auth"
              color="primary"
              style="font-size: 0.76rem; margin-top: 4px"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- ── RESPONSE PANE ─────────────────────────────────────── -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0">

        <!-- Response header row: tabs + status badges -->
        <div style="
          display: flex;
          align-items: center;
          background: var(--ax-surface-raised);
          border-bottom: 1px solid var(--ax-border);
          flex-shrink: 0;
          min-height: 34px;
        ">
          <q-tabs
            v-model="viewTab"
            dense
            align="left"
            class="ins-tabs"
            :active-color="$q.dark.isActive ? 'white' : 'primary'"
            indicator-color="primary"
            style="flex: 1; background: transparent"
          >
            <q-tab name="tree" label="Preview" no-caps />
            <q-tab name="raw"  label="Raw"     no-caps />
          </q-tabs>

          <!-- Status badges -->
          <div
            v-if="lastResult"
            style="display: flex; align-items: center; gap: 8px; padding: 0 12px; flex-shrink: 0"
          >
            <span
              class="ax-badge font-mono"
              :class="lastResult.ok ? 'ax-badge--ok' : 'ax-badge--error'"
            >
              {{ lastResult.ok ? '200 OK' : (lastResult.status || 'ERR') }}
            </span>
            <span class="ins-status-meta font-mono">{{ lastResult.durationMs }} ms</span>
            <span
              v-if="lastResult.effect"
              class="ax-badge ax-badge--primary font-mono"
            >{{ lastResult.effect }}</span>
          </div>
        </div>

        <!-- Tab panels -->
        <q-tab-panels
          v-model="viewTab"
          animated
          class="transparent-panels"
          style="flex: 1; overflow: hidden; min-height: 0"
        >
          <!-- Preview (JSON tree) -->
          <q-tab-panel name="tree" class="q-pa-none" style="height: 100%; overflow: hidden">
            <JsonTree
              :value="lastResult?.response ?? null"
              max-height="100%"
              style="height: 100%; border: none; border-radius: 0; border-left: none; border-right: none; border-bottom: none"
              :empty-text="sending ? 'Waiting for response…' : 'Send an intent to see the response here'"
            />
          </q-tab-panel>

          <!-- Raw -->
          <q-tab-panel name="raw" class="q-pa-none" style="height: 100%; overflow: auto">
            <div v-if="lastResult" class="ax-raw-viewer">{{ lastResult.raw }}</div>
            <div v-else class="ax-empty">
              <q-icon name="code" class="ax-empty-icon" />
              <div class="ax-empty-text">No raw data yet</div>
            </div>
          </q-tab-panel>
        </q-tab-panels>

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
const reqTab     = ref<'body' | 'context'>('body');

const quickPicks = [
  'catalog.list',
  'catalog.describe',
  'catalog.search',
  'axis.sessions.list',
  'axis.identities.list',
  'axis.capsules.list',
];

/* ── Autocomplete ─────────────────────────────────────── */
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
    allOpts.value      = catalog.map((i) => i.intent);
    filteredOpts.value = allOpts.value.slice(0, 60);
  } catch { /* keep quickPicks */ }

  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

/* ── Computed ─────────────────────────────────────────── */
const bodyByteSize = computed(() => {
  const bytes = new TextEncoder().encode(bodyText.value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
});

/* ── Actions ──────────────────────────────────────────── */
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
      ok:         false,
      status:     0,
      durationMs: 0,
      response:   { error: e.message },
      raw:        e.message,
      effect:     'PARSE_ERROR',
    };
    $q.notify({ message: e.message, color: 'negative', icon: 'error', timeout: 3000 });
  } finally {
    sending.value = false;
  }
}
</script>
