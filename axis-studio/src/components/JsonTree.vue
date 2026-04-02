<template>
  <div class="json-tree" :class="treeClass">
    <!-- Toolbar -->
    <div class="jt-header row no-wrap items-center q-px-sm q-py-xs">
      <span class="text-caption jt-type-label q-mr-auto font-mono">{{
        typeLabel
      }}</span>
      <q-btn
        flat
        dense
        round
        size="xs"
        icon="content_copy"
        title="Copy JSON"
        @click="copyAll"
      />
    </div>

    <q-separator />

    <!-- Empty state -->
    <div
      v-if="!hasValue"
      class="jt-empty column items-center justify-center q-pa-xl"
    >
      <q-icon name="data_object" size="32px" class="jt-empty-icon q-mb-sm" />
      <div class="text-caption">{{ emptyText }}</div>
    </div>

    <!-- Tree content -->
    <div v-else class="jt-scroll q-pa-sm font-mono" :style="scrollStyle">
      <JsonNode :value="value" :depth="0" :max-depth="maxDepth" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import JsonNode from './JsonNode.vue';

const $q = useQuasar();

const props = withDefaults(
  defineProps<{
    value?: unknown;
    maxDepth?: number;
    maxHeight?: string;
    emptyText?: string;
  }>(),
  {
    maxDepth: 3,
    maxHeight: '420px',
    emptyText: 'No data',
  },
);

const hasValue = computed(
  () => props.value !== undefined && props.value !== null,
);

const typeLabel = computed(() => {
  if (!hasValue.value) return '—';
  if (Array.isArray(props.value))
    return `Array  ·  ${(props.value as unknown[]).length} items`;
  if (typeof props.value === 'object')
    return `Object  ·  ${Object.keys(props.value as object).length} keys`;
  return typeof props.value;
});

async function copyAll() {
  try {
    const text = JSON.stringify(props.value, null, 2);
    await navigator.clipboard.writeText(text);
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

const scrollStyle = computed(() => ({
  maxHeight: props.maxHeight,
  overflowY: 'auto' as const,
}));

const treeClass = computed(() =>
  $q.dark.isActive ? 'json-tree--dark' : 'json-tree--light',
);
</script>
