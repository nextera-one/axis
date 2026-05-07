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
              <q-card v-if="uploadSpec" flat bordered class="q-mt-md">
                <q-card-section class="q-gutter-sm">
                  <div class="sender-info-label">{{ uploadSpec.label }}</div>
                  <div class="sender-info-value">
                    {{ uploadSpec.help }}
                  </div>
                  <q-file
                    v-model="selectedFile"
                    dense
                    outlined
                    clearable
                    :accept="uploadSpec.accept"
                    :label="uploadSpec.fileLabel"
                    hint="The JSON body stays active for metadata fields"
                  />
                  <div class="sender-info-value">
                    {{ uploadStatus }}
                  </div>
                </q-card-section>
              </q-card>
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
                  <div class="sender-info-label">Secure Alias Mode</div>
                  <div class="sender-info-value">
                    {{ auth.secureIntentAliasMode ? 'ENABLED' : 'DISABLED' }}
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-section>
                  <div class="sender-info-label">Intent Alias</div>
                  <div class="sender-info-value">
                    {{
                      !auth.secureIntentAliasMode
                        ? 'PLAINTEXT_MODE'
                        : auth.capsuleId && auth.intentSecret
                          ? 'ENCRYPTED_ON_WIRE'
                          : auth.capsuleId
                            ? 'SECRET_MISSING'
                            : 'BOOTSTRAP_ON_FIRST_SECURE_INTENT'
                    }}
                  </div>
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
            <div class="sender-result-nav">
              <q-tabs
                v-model="viewerTarget"
                dense
                align="left"
                indicator-color="primary"
                class="sender-tabs"
              >
                <q-tab name="response" label="Response" />
                <q-tab name="request" label="Request" />
              </q-tabs>

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
            </div>

            <div v-if="lastResult" class="sender-result-meta">
              <span :class="lastResult.ok ? 'text-positive' : 'text-negative'">
                {{ lastResult.ok ? lastResult.status + ' OK' : 'ERR ' + lastResult.status }}
              </span>
              <span>{{ activeSnapshot?.transport || '—' }}</span>
              <span>{{ lastResult.durationMs }}ms</span>
            </div>
          </div>

          <q-tab-panels v-model="viewTab" animated class="sender-panels">
            <q-tab-panel name="tree" class="sender-tab-panel sender-tab-panel--result">
              <JsonTree
                v-if="activeSnapshot"
                :value="activeSnapshot.tree"
                class="sender-tree"
                :max-height="'100%'"
              />
              <div v-else class="sender-empty">
                <q-icon name="terminal" size="48px" />
                <span>{{ sending ? 'Intercepting frame…' : 'Idle - awaiting intent' }}</span>
              </div>
            </q-tab-panel>

            <q-tab-panel name="raw" class="sender-tab-panel sender-tab-panel--result">
              <pre v-if="activeSnapshot" class="sender-raw">{{ activeSnapshot.raw }}</pre>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import JsonEditor from 'src/components/JsonEditor.vue';
import JsonTree from 'src/components/JsonTree.vue';
import {
  sendIntent,
  fetchCatalog,
  type IntentCatalogEntry,
  type SendResult,
} from 'src/services/axis-client';
import { useAuthStore } from 'stores/auth';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

type UploadSpec = {
  mode: 'base64' | 'typescript';
  label: string;
  fileLabel: string;
  help: string;
  accept: string;
  required: boolean;
};

const INTENT_UPLOAD_SPECS: Record<string, UploadSpec> = {
  'upload.uploadFile': {
    mode: 'base64',
    label: 'AXIS Upload Payload',
    fileLabel: 'Select image file',
    help: 'The studio encodes the selected file into the AXIS body as base64.',
    accept: 'image/*,.svg,.heic,.heif,.avif,.bmp,.ico,.tiff',
    required: true,
  },
  'node.types.create': {
    mode: 'typescript',
    label: 'Optional Script Attach',
    fileLabel: 'Attach .ts script',
    help: 'If provided, the script is embedded into the create DTO as text.',
    accept: '.ts,text/plain,text/typescript,application/typescript',
    required: false,
  },
  'node.types.script.swap': {
    mode: 'typescript',
    label: 'Node Type Script',
    fileLabel: 'Select replacement .ts script',
    help: 'The selected script is sent as AXIS body content, not multipart.',
    accept: '.ts,text/plain,text/typescript,application/typescript',
    required: true,
  },
  'node.type.engine.script.upload': {
    mode: 'typescript',
    label: 'Engine Script',
    fileLabel: 'Select engine .ts script',
    help: 'The selected script is sent as AXIS body content, not multipart.',
    accept: '.ts,text/plain,text/typescript,application/typescript',
    required: true,
  },
};

const intent = ref<string>('catalog.list');
const bodyText = ref('{\n  \n}');
const selectedFile = ref<File | null>(null);
const sending = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewerTarget = ref<'response' | 'request'>('response');
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
  'projects.page',
];

const allOpts = ref<string[]>([...quickPicks]);
const filteredOpts = ref<string[]>([...quickPicks]);
const catalogEntries = ref<IntentCatalogEntry[]>([]);
const lastAutoBody = ref(bodyText.value);

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
    catalogEntries.value = catalog;
    allOpts.value = catalog.map((i) => i.intent);
    filteredOpts.value = allOpts.value.slice(0, 60);
    applyIntentDefaults(intent.value);
  } catch {
    /* fallback to quick picks */
  }

  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

const selectedCatalogEntry = computed(() => {
  return catalogEntries.value.find((entry) => entry.intent === intent.value) || null;
});

function catalogBodyFields(entry: IntentCatalogEntry | null | undefined) {
  const schema =
    entry?.schema && typeof entry.schema === 'object' && !Array.isArray(entry.schema)
      ? (entry.schema as { fields?: unknown })
      : null;
  const inputSchema =
    entry?.inputSchema &&
    typeof entry.inputSchema === 'object' &&
    !Array.isArray(entry.inputSchema)
      ? (entry.inputSchema as { fields?: unknown })
      : null;
  const request = entry?.request;
  const candidates = [
    entry?.input,
    entry?.fields,
    request?.input,
    request?.fields,
    schema?.fields,
    inputSchema?.fields,
  ];

  return candidates
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter(
      (field): field is { name: string; kind: string; required?: boolean; scope?: string } =>
        field &&
        typeof field === 'object' &&
        typeof (field as { name?: unknown }).name === 'string' &&
        typeof (field as { kind?: unknown }).kind === 'string' &&
        ((field as { scope?: string }).scope || 'body') === 'body',
    );
}

function defaultFieldValue(kind: string) {
  switch (kind) {
    case 'bool':
      return false;
    case 'u64':
      return 0;
    case 'obj':
      return {};
    case 'arr':
      return [];
    default:
      return '';
  }
}

function buildDefaultBody(entry: IntentCatalogEntry | null, nextIntent: string) {
  const fields = catalogBodyFields(entry);
  if (nextIntent === 'catalog.list') {
    return {
      page: 1,
      pageSize: 500,
    };
  }

  if (nextIntent.endsWith('.page') || fields.some((field) => field.name === 'params')) {
    return {
      page: 1,
      limit: 5,
      filter: {},
      sort: {},
    };
  }

  const requiredFields = fields.filter((field) => field.required);
  if (!requiredFields.length) return null;

  return Object.fromEntries(
    requiredFields.map((field) => [field.name, defaultFieldValue(field.kind)]),
  );
}

function canReplaceBody() {
  const trimmed = bodyText.value.trim();
  return !trimmed || trimmed === '{}' || bodyText.value === lastAutoBody.value;
}

function applyIntentDefaults(nextIntent: string) {
  if (!nextIntent || !canReplaceBody()) return;
  const defaultBody = buildDefaultBody(selectedCatalogEntry.value, nextIntent);
  if (!defaultBody) return;

  bodyText.value = JSON.stringify(defaultBody, null, 2);
  lastAutoBody.value = bodyText.value;
}

watch(intent, (nextIntent) => {
  applyIntentDefaults(nextIntent);
});

const bodyByteSize = computed(() => {
  const bytes = new TextEncoder().encode(bodyText.value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
});

const uploadSpec = computed(() => INTENT_UPLOAD_SPECS[intent.value] || null);

const uploadStatus = computed(() => {
  if (!uploadSpec.value) return 'No upload adapter active';
  if (!selectedFile.value) {
    return uploadSpec.value.required
      ? 'File required for this intent'
      : 'File optional for this intent';
  }

  const bytes = selectedFile.value.size;
  const sizeLabel =
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
  return `${selectedFile.value.name} • ${sizeLabel}`;
});

const activeSnapshot = computed(() => {
  if (!lastResult.value) return null;
  return viewerTarget.value === 'response'
    ? lastResult.value.responseSnapshot
    : lastResult.value.requestSnapshot;
});

function clearForm() {
  intent.value = '';
  bodyText.value = '{\n  \n}';
  selectedFile.value = null;
  lastResult.value = null;
  viewerTarget.value = 'response';
}

async function readFileAsBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const commaIndex = value.indexOf(',');
      resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
    };
    reader.onerror = () => reject(new Error('Unable to read selected file'));
    reader.readAsDataURL(file);
  });
}

async function decorateUploadPayload(body: unknown): Promise<unknown> {
  const spec = uploadSpec.value;
  const file = selectedFile.value;
  if (!spec) return body;

  if (!file) {
    if (spec.required) {
      throw new Error('Select a file for this intent');
    }
    return body;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Upload intents expect a JSON object body');
  }

  const payload = { ...(body as Record<string, unknown>) };

  if (spec.mode === 'base64') {
    payload.base64 = await readFileAsBase64(file);
    payload.file_name = file.name;
    payload.mime_type = file.type || 'application/octet-stream';
    return payload;
  }

  if (!file.name.toLowerCase().endsWith('.ts')) {
    throw new Error('Script uploads require a .ts file');
  }

  payload.script_file_name = file.name;
  payload.script_file_text = await file.text();
  return payload;
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
    if (uploadSpec.value) {
      payload = await decorateUploadPayload(body);
    }

    lastResult.value = await sendIntent(intent.value, payload, undefined, {
      metadata: selectedCatalogEntry.value,
    });
    viewerTarget.value = 'response';
    viewTab.value = 'tree';
  } catch (e: any) {
    lastResult.value = {
      ok: false,
      status: 0,
      durationMs: 0,
      response: { error: e.message },
      raw: e.message,
      effect: 'PARSE_ERROR',
      requestSnapshot: {
        transport: 'json',
        tree: { error: 'Request JSON parse failed', bodyText: bodyText.value },
        raw: bodyText.value,
      },
      responseSnapshot: {
        transport: 'text',
        tree: { error: e.message },
        raw: e.message,
      },
      responseHeaders: {},
    };
    viewerTarget.value = 'response';
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
