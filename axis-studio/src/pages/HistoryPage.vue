<template>
  <div class="history-page">
    <div class="history-head">
      <div>
        <h1>Protocol Audit Feed</h1>
        <p>{{ history.filtered.length }} sequences logged</p>
      </div>
      <div class="history-head-actions">
        <q-input
          v-model="history.filterQuery"
          dense
          outlined
          clearable
          placeholder="Filter by intent/effect..."
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
        <q-btn
          v-if="history.entries.length"
          flat
          no-caps
          color="negative"
          icon="delete_sweep"
          label="Purge"
          @click="confirmClear"
        />
      </div>
    </div>

    <q-splitter v-model="splitterModel" class="history-splitter">
      <template #before>
        <div class="history-list">
          <div v-if="!history.filtered.length" class="history-empty">
            <q-icon name="history" size="36px" />
            <span>
              {{
                history.entries.length
                  ? 'Zero entries match filter'
                  : 'Awaiting first protocol dispatch'
              }}
            </span>
          </div>

          <q-list v-else separator>
            <q-item
              v-for="entry in history.filtered"
              :key="entry.id"
              clickable
              :active="selectedId === entry.id"
              active-class="history-item--active"
              class="history-item"
              @click="selectedId = entry.id"
            >
              <q-item-section avatar>
                <span
                  class="history-dot"
                  :class="entry.status === 'ok' ? 'history-dot--ok' : 'history-dot--err'"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ entry.intent }}</q-item-label>
                <q-item-label caption>
                  {{ new Date(entry.ts).toLocaleString() }} | {{ entry.id.slice(0, 12) }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-badge
                  :color="entry.status === 'ok' ? 'positive' : 'negative'"
                  text-color="black"
                >
                  {{ entry.responseEffect || (entry.status === 'ok' ? 'OK' : 'ERROR') }}
                </q-badge>
                <small class="text-grey-5 q-mt-xs">{{ entry.durationMs }}ms</small>
              </q-item-section>

              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="close"
                  color="negative"
                  @click.stop="history.remove(entry.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </template>

      <template #after>
        <div class="history-detail">
          <div v-if="selectedEntry" class="history-detail-card">
            <div class="history-detail-head">
              <div>
                <div class="history-eyebrow">Transaction Trace</div>
                <h2>{{ selectedEntry.intent }}</h2>
              </div>
              <q-btn flat round dense icon="close" @click="selectedId = ''" />
            </div>

            <div class="history-kv">
              <div>
                <small>Protocol Node</small>
                <span>{{ selectedEntry.nodeUrl }}</span>
              </div>
              <div>
                <small>Sequence TS</small>
                <span>{{ new Date(selectedEntry.ts).toLocaleString() }}</span>
              </div>
              <div>
                <small>HTTP Status</small>
                <span>{{ selectedEntry.httpStatus ?? '—' }}</span>
              </div>
            </div>

            <div class="history-trace">
              <div v-for="(step, i) in traceSteps" :key="i" class="history-step">
                <span class="history-step-dot" :style="{ background: step.color }" />
                <div>
                  <strong>{{ step.label }}</strong>
                  <p>{{ step.detail }}</p>
                </div>
              </div>
            </div>

            <q-tabs
              v-model="currentDetailTab"
              dense
              align="left"
              indicator-color="primary"
              class="history-tabs"
            >
              <q-tab name="request" label="Request" />
              <q-tab name="requestRaw" label="Request Raw" />
              <q-tab name="response" label="Response" />
              <q-tab name="responseRaw" label="Response Raw" />
            </q-tabs>

            <div class="history-json">
              <JsonTree
                v-if="currentDetailTab === 'request' || currentDetailTab === 'response'"
                :value="
                  currentDetailTab === 'response'
                    ? responseSnapshot.tree
                    : requestSnapshot.tree
                "
                :max-height="'100%'"
                class="history-json-tree"
              />
              <pre v-else class="history-raw">
{{ currentDetailTab === 'responseRaw' ? responseSnapshot.raw : requestSnapshot.raw }}
              </pre>
            </div>
          </div>

          <div v-else class="history-empty history-empty--detail">
            <q-icon name="query_stats" size="56px" />
            <span>Select an entry from the feed</span>
          </div>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import JsonTree from 'src/components/JsonTree.vue';
import { useHistoryStore } from 'stores/history';

const $q = useQuasar();
const route = useRoute();
const history = useHistoryStore();

const selectedId = ref('');
const splitterModel = ref(54);
const currentDetailTab = ref<'request' | 'requestRaw' | 'response' | 'responseRaw'>(
  'response',
);

const selectedEntry = computed(() =>
  history.filtered.find((e) => e.id === selectedId.value) ?? null,
);

const requestSnapshot = computed(() => {
  if (selectedEntry.value?.requestSnapshot) {
    return selectedEntry.value.requestSnapshot;
  }
  return {
    transport: 'legacy',
    tree: parseSafe(selectedEntry.value?.requestBody || ''),
    raw: selectedEntry.value?.requestBody || '',
  };
});

const responseSnapshot = computed(() => {
  if (selectedEntry.value?.responseSnapshot) {
    return selectedEntry.value.responseSnapshot;
  }
  return {
    transport: 'legacy',
    tree: parseSafe(selectedEntry.value?.responseBody || ''),
    raw: selectedEntry.value?.responseBody || '',
  };
});

const traceSteps = computed(() => {
  if (!selectedEntry.value) return [];
  const e = selectedEntry.value;
  return [
    {
      label: 'Intent Dispatch',
      detail: 'Binary AXIS frame broadcast to protocol cluster.',
      color: 'var(--ax-primary)',
    },
    {
      label: 'Network Resolution',
      detail: `Route established within ${e.durationMs}ms.`,
      color: 'var(--ax-primary)',
    },
    {
      label: 'Execution Finality',
      detail:
        e.status === 'ok'
          ? 'Positive confirmation receipt acknowledged.'
          : 'Terminal error state encountered during processing.',
      color: e.status === 'ok' ? 'var(--ax-ok)' : 'var(--ax-error)',
    },
    ...(e.responseEffect
      ? [
          {
            label: 'Side Effect Logged',
            detail: `State transition recorded as: ${e.responseEffect}`,
            color: 'var(--ax-primary)',
          },
        ]
      : []),
  ];
});

function parseSafe(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function confirmClear() {
  $q.dialog({
    title: 'Purge Logs',
    message:
      'Are you sure you want to delete all historical sequence logs? This action is irreversible.',
    cancel: { flat: true, color: 'grey' },
    ok: { label: 'Confirm purge', color: 'negative', flat: true },
    persistent: true,
  }).onOk(() => {
    history.clear();
    selectedId.value = '';
  });
}

onMounted(() => {
  const intent = route.query.intent;
  if (typeof intent === 'string' && intent.trim()) {
    history.filterQuery = intent.trim();
  }
});
</script>
