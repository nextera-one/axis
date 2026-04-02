<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <!-- Left: Request builder -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">Intent Sender</div>

            <!-- Intent selector with autocomplete -->
            <q-input
              v-model="intent"
              label="Intent"
              dense
              outlined
              dark
              placeholder="e.g. catalog.list"
              class="q-mb-sm"
            >
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>

            <!-- Quick picks -->
            <div class="q-mb-md">
              <q-chip
                v-for="q in quickIntents"
                :key="q"
                dense
                clickable
                color="grey-9"
                text-color="grey-3"
                size="sm"
                @click="intent = q"
              >
                {{ q }}
              </q-chip>
            </div>

            <!-- Body editor -->
            <q-input
              v-model="bodyText"
              label="Body (JSON)"
              type="textarea"
              dense
              outlined
              dark
              autogrow
              :input-style="{ fontFamily: 'monospace', minHeight: '120px' }"
              class="q-mb-sm"
            />

            <!-- Send -->
            <q-btn
              color="primary"
              icon="send"
              label="Send Intent"
              :loading="sending"
              :disable="!intent"
              @click="send"
              class="full-width"
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- Right: Response viewer -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6 text-primary">Response</div>
              <q-space />
              <q-badge
                v-if="lastResult"
                :color="lastResult.ok ? 'positive' : 'negative'"
              >
                {{ lastResult.status }} · {{ lastResult.durationMs }}ms
              </q-badge>
            </div>

            <!-- Tabs for JSON / Raw -->
            <q-tabs
              v-model="viewTab"
              dense
              align="left"
              class="q-mb-sm text-grey-5"
            >
              <q-tab name="json" label="JSON" />
              <q-tab name="raw" label="Raw" />
            </q-tabs>

            <q-tab-panels v-model="viewTab" animated class="bg-dark">
              <q-tab-panel name="json" class="q-pa-none">
                <pre
                  class="response-hex q-pa-sm"
                  style="max-height: 400px; overflow: auto"
                  >{{ formattedJson }}</pre
                >
              </q-tab-panel>
              <q-tab-panel name="raw" class="q-pa-none">
                <pre
                  class="response-hex q-pa-sm"
                  style="max-height: 400px; overflow: auto"
                  >{{ lastResult?.raw || 'No response yet' }}</pre
                >
              </q-tab-panel>
            </q-tab-panels>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { sendIntent, type SendResult } from 'src/services/axis-client';

const intent = ref('catalog.list');
const bodyText = ref('{}');
const sending = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewTab = ref('json');

const quickIntents = [
  'catalog.list',
  'catalog.search',
  'catalog.describe',
  'capsule.list',
  'axis.sessions.list',
  'axis.identities.list',
];

const formattedJson = computed(() => {
  if (!lastResult.value) return 'No response yet';
  try {
    return JSON.stringify(lastResult.value.response, null, 2);
  } catch {
    return String(lastResult.value.response);
  }
});

async function send() {
  sending.value = true;
  try {
    let body: Record<string, unknown> = {};
    if (bodyText.value.trim()) {
      body = JSON.parse(bodyText.value);
    }
    lastResult.value = await sendIntent(intent.value, body);
  } catch (e: any) {
    lastResult.value = {
      ok: false,
      status: 0,
      durationMs: 0,
      response: { error: 'Invalid JSON body: ' + e.message },
      raw: e.message,
      effect: 'PARSE_ERROR',
    };
  } finally {
    sending.value = false;
  }
}
</script>
