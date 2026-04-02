<template>
  <q-page class="ax-page q-pa-md">
    <div class="row q-col-gutter-md">

      <!-- ══════ REQUEST PANEL ════════════════════════════════ -->
      <div class="col-12 col-lg-5">
        <div class="ax-panel q-mb-md">
          <div class="ax-panel-header row items-center">
            <q-icon name="send" color="primary" size="15px" class="q-mr-xs" />
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
            <div class="q-mb-sm">
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
                @filter="filterIntents"
              >
                <template #prepend>
                  <q-icon name="chevron_right" color="primary" />
                </template>
                <template #selected-item="{ opt }">
                  <span class="font-mono">{{ opt }}</span>
                </template>
                <template #option="{ itemProps, opt }">
                  <q-item v-bind="itemProps" dense>
                    <q-item-section>
                      <q-item-label class="font-mono text-caption">{{ opt }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
                <template #no-option>
                  <q-item dense>
                    <q-item-section class="text-grey-5 text-caption">
                      Type an intent name and press Enter
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Quick picks -->
            <div class="q-mb-md">
              <q-chip
                v-for="q in quickPicks"
                :key="q"
                dense
                clickable
                size="sm"
                :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
                :text-color="$q.dark.isActive ? 'grey-4' : 'grey-8'"
                class="q-mr-xs q-mb-xs font-mono"
                @click="intent = q"
              >
                {{ q }}
              </q-chip>
            </div>

            <!-- Body JSON editor -->
            <div
              class="text-caption q-mb-xs q-ml-xs"
              :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
            >
              Body (JSON)
            </div>
            <JsonEditor
              v-model="bodyText"
              min-height="160px"
              class="q-mb-md"
              :show-line-numbers="true"
            />

            <!-- Context row -->
            <div class="row items-center q-gutter-xs q-mb-md">
              <q-chip
                dense
                icon="person"
                size="sm"
                :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
                :text-color="$q.dark.isActive ? 'grey-4' : 'grey-7'"
              >
                {{ auth.actorId || 'anonymous' }}
              </q-chip>
              <q-chip
                v-if="auth.capsuleId"
                dense
                icon="inventory_2"
                size="sm"
                :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
                :text-color="$q.dark.isActive ? 'grey-4' : 'grey-7'"
              >
                {{ auth.capsuleId }}
              </q-chip>
            </div>

            <!-- Send button -->
            <q-btn
              unelevated
              color="primary"
              icon="send"
              label="Send Intent"
              :loading="sending"
              :disable="!intent"
              class="full-width"
              @click="send"
            />
          </div>
        </div>
      </div>

      <!-- ══════ RESPONSE PANEL ═══════════════════════════════ -->
      <div class="col-12 col-lg-7">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center no-wrap">
            <q-icon name="inbox" color="primary" size="15px" class="q-mr-xs" />
            <span class="ax-panel-title q-mr-auto">Response</span>

            <template v-if="lastResult">
              <q-badge
                :color="lastResult.ok ? 'positive' : 'negative'"
                class="q-mr-xs"
              >
                {{ lastResult.status }}
              </q-badge>
              <q-badge color="blue-grey-7" class="q-mr-xs font-mono">
                {{ lastResult.durationMs }}ms
              </q-badge>
              <q-badge
                v-if="lastResult.effect"
                color="accent"
                class="font-mono"
              >
                {{ lastResult.effect }}
              </q-badge>
            </template>
          </div>

          <!-- Tabs: JSON Tree | Raw -->
          <q-tabs
            v-model="viewTab"
            dense
            align="left"
            class="q-px-sm"
            :active-color="$q.dark.isActive ? 'cyan-3' : 'primary'"
            indicator-color="primary"
          >
            <q-tab name="tree" icon="account_tree" label="JSON Tree" />
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
              <div v-if="lastResult" class="ax-raw-viewer">{{ lastResult.raw }}</div>
              <div v-else class="column items-center justify-center q-pa-xl">
                <q-icon
                  name="code"
                  size="32px"
                  :color="$q.dark.isActive ? 'grey-7' : 'grey-5'"
                  class="q-mb-sm"
                />
                <div
                  class="text-caption"
                  :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
                >
                  No raw data yet
                </div>
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

const $q   = useQuasar();
const route = useRoute();
const auth  = useAuthStore();

const intent   = ref<string>('catalog.list');
const bodyText = ref('{\n  \n}');
const sending  = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewTab  = ref<'tree' | 'raw'>('tree');

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

function filterIntents(
  val: string,
  update: (fn: () => void) => void,
) {
  update(() => {
    const q = val.toLowerCase();
    filteredOpts.value = q
      ? allOpts.value.filter((i) => i.toLowerCase().includes(q)).slice(0, 60)
      : allOpts.value.slice(0, 60);
  });
}

onMounted(async () => {
  // Pre-load catalog for autocomplete
  try {
    const catalog = await fetchCatalog();
    allOpts.value = catalog.map((i) => i.intent);
    filteredOpts.value = allOpts.value.slice(0, 60);
  } catch {
    // fallback to quickPicks
  }

  // Honor ?intent= query param
  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

/* ── Actions ───────────────────────────────────────────── */
function clearForm() {
  intent.value   = '';
  bodyText.value = '{\n  \n}';
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
