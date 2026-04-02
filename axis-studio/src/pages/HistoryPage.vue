<template>
  <q-page padding>
    <q-card flat bordered class="bg-dark">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-h6 text-primary">History</div>
          <q-space />
          <q-btn
            v-if="history.entries.length"
            flat
            dense
            color="negative"
            icon="delete_sweep"
            label="Clear"
            @click="confirmClear"
          />
        </div>

        <q-input
          v-model="history.filterQuery"
          label="Filter by intent or effect…"
          dense
          outlined
          dark
          clearable
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="filter_list" />
          </template>
        </q-input>

        <q-list separator>
          <q-expansion-item
            v-for="entry in history.filtered"
            :key="entry.id"
            dense
            group="history"
            :header-class="entry.status === 'ok' ? '' : 'text-negative'"
          >
            <template v-slot:header>
              <q-item-section avatar>
                <q-icon
                  :name="entry.status === 'ok' ? 'check_circle' : 'error'"
                  :color="entry.status === 'ok' ? 'positive' : 'negative'"
                  size="xs"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="font-mono text-caption">{{
                  entry.intent
                }}</q-item-label>
                <q-item-label caption>
                  {{ new Date(entry.ts).toLocaleTimeString() }} ·
                  {{ entry.durationMs }}ms · {{ entry.responseEffect }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  size="xs"
                  color="grey-6"
                  @click.stop="history.remove(entry.id)"
                />
              </q-item-section>
            </template>

            <q-card class="bg-grey-10">
              <q-card-section>
                <q-tabs
                  v-model="detailTab"
                  dense
                  align="left"
                  class="text-grey-5 q-mb-sm"
                >
                  <q-tab name="response" label="Response" />
                  <q-tab name="request" label="Request" />
                </q-tabs>

                <q-tab-panels v-model="detailTab" animated class="bg-grey-10">
                  <q-tab-panel name="response" class="q-pa-none">
                    <pre
                      class="response-hex q-pa-sm"
                      style="max-height: 300px; overflow: auto"
                      >{{ entry.responseBody }}</pre
                    >
                  </q-tab-panel>
                  <q-tab-panel name="request" class="q-pa-none">
                    <pre
                      class="response-hex q-pa-sm"
                      style="max-height: 300px; overflow: auto"
                      >{{ entry.requestBody }}</pre
                    >
                  </q-tab-panel>
                </q-tab-panels>

                <div class="text-caption text-grey-6 q-mt-sm">
                  Node: {{ entry.nodeUrl }} · PID: {{ entry.id }}
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <q-item v-if="!history.filtered.length">
            <q-item-section class="text-center text-grey-6 q-pa-xl">
              <q-icon name="history" size="48px" class="q-mb-md" />
              <div>
                {{
                  history.entries.length
                    ? 'No matching entries'
                    : 'No history yet — send some intents!'
                }}
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useHistoryStore } from 'stores/history';

const $q = useQuasar();
const history = useHistoryStore();
const detailTab = ref('response');

function confirmClear() {
  $q.dialog({
    title: 'Clear History',
    message: 'Delete all history entries?',
    cancel: true,
    persistent: true,
    dark: true,
  }).onOk(() => {
    history.clear();
  });
}
</script>
