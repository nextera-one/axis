<template>
  <div class="json-editor" :class="editorClass">
    <!-- Toolbar for editable mode -->
    <div
      v-if="!readOnly"
      class="jed-toolbar row no-wrap items-center q-px-sm q-py-xs"
    >
      <transition name="jed-fade" mode="out-in">
        <div
          v-if="parseError"
          key="err"
          class="row no-wrap items-center"
          style="max-width: 68%; overflow: hidden"
        >
          <q-icon
            name="error_outline"
            color="negative"
            size="13px"
            class="q-mr-xs flex-shrink-0"
          />
          <span class="text-caption text-negative ellipsis">{{
            parseError
          }}</span>
        </div>
        <div v-else key="ok" class="row no-wrap items-center">
          <q-icon
            name="check_circle_outline"
            color="positive"
            size="13px"
            class="q-mr-xs"
          />
          <span class="text-caption text-positive">Valid JSON</span>
        </div>
      </transition>
      <q-space />
      <q-btn
        flat
        dense
        round
        size="xs"
        icon="format_indent_increase"
        :disable="!!parseError"
        title="Format JSON"
        @click="format"
      />
      <q-btn
        flat
        dense
        round
        size="xs"
        icon="content_copy"
        title="Copy to clipboard"
        @click="copyAll"
      />
    </div>

    <!-- CodeMirror instance -->
    <Codemirror
      v-model="local"
      :extensions="cmExtensions"
      :style="cmStyle"
      :disabled="readOnly"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Codemirror } from 'vue-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, lineNumbers } from '@codemirror/view';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readOnly?: boolean;
    height?: string;
    minHeight?: string;
    showLineNumbers?: boolean;
  }>(),
  {
    readOnly: false,
    height: 'auto',
    minHeight: '140px',
    showLineNumbers: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [v: string];
  parse: [data: unknown, valid: boolean];
}>();

const local = ref(props.modelValue);
const parseError = ref<string | null>(null);

watch(
  () => props.modelValue,
  (v) => {
    if (v !== local.value) {
      local.value = v;
      validate(v);
    }
  },
);

function validate(v: string): unknown {
  if (!v || !v.trim()) {
    parseError.value = null;
    return null;
  }
  try {
    const data = JSON.parse(v);
    parseError.value = null;
    return data;
  } catch (e: any) {
    parseError.value = (e.message ?? 'Invalid JSON')
      .replace(/^.*?:\s*/, '')
      .split('\n')[0]
      .slice(0, 80);
    return null;
  }
}

function handleChange(v: string) {
  emit('update:modelValue', v);
  const data = validate(v);
  emit('parse', data, !parseError.value);
}

function format() {
  try {
    const fmt = JSON.stringify(JSON.parse(local.value), null, 2);
    local.value = fmt;
    emit('update:modelValue', fmt);
    parseError.value = null;
  } catch {}
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(local.value);
    $q.notify({
      message: 'Copied!',
      icon: 'check',
      color: 'positive',
      timeout: 1200,
      position: 'top-right',
    });
  } catch {
    $q.notify({ message: 'Copy failed', color: 'negative', timeout: 1200 });
  }
}

/* ─── CodeMirror config ─────────────────────────────────── */

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent' },
  '.cm-content': { caretColor: 'var(--q-primary)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--q-primary)' },
  '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.025)' },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(0,188,212,0.15)',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(0,188,212,0.22)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9a9aaa',
  },
});

const cmExtensions = computed(() => [
  json(),
  $q.dark.isActive ? oneDark : lightTheme,
  EditorView.lineWrapping,
  ...(props.showLineNumbers ? [lineNumbers()] : []),
  ...(props.readOnly ? [EditorView.editable.of(false)] : []),
]);

const cmStyle = computed(() => ({
  minHeight: props.minHeight,
  fontSize: '0.82rem',
  fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
  ...(props.height !== 'auto' ? { height: props.height } : {}),
}));

const editorClass = computed(() => [
  `json-editor--${$q.dark.isActive ? 'dark' : 'light'}`,
  { 'json-editor--readonly': props.readOnly },
  { 'json-editor--error': !!parseError.value },
]);

// initial validation
validate(props.modelValue);
</script>
