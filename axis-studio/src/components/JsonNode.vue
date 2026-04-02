<script setup lang="ts">
import { ref, computed } from 'vue';

defineOptions({ name: 'JsonNode' });

const props = withDefaults(
  defineProps<{
    value: unknown;
    label?: string;
    isArrayItem?: boolean;
    depth?: number;
    maxDepth?: number;
    trailingComma?: boolean;
  }>(),
  {
    isArrayItem: false,
    depth: 0,
    maxDepth: 3,
    trailingComma: false,
  },
);

const open = ref(props.depth < props.maxDepth);

const isNull = computed(() => props.value === null || props.value === undefined);
const isArr = computed(() => Array.isArray(props.value));
const isObj = computed(() => typeof props.value === 'object' && props.value !== null && !isArr.value);
const isExpandable = computed(() => isArr.value || isObj.value);
const isEmpty = computed(() => isExpandable.value && childKeys.value.length === 0);

const childKeys = computed((): string[] => {
  if (isArr.value) return [...(props.value as unknown[]).keys()].map(String);
  if (isObj.value) return Object.keys(props.value as Record<string, unknown>);
  return [];
});

const openBr = computed(() => (isArr.value ? '[' : '{'));
const closeBr = computed(() => (isArr.value ? ']' : '}'));

const sizeHint = computed(() => {
  const n = childKeys.value.length;
  return isArr.value ? `${n} item${n !== 1 ? 's' : ''}` : `${n} key${n !== 1 ? 's' : ''}`;
});

function childValue(k: string): unknown {
  if (isArr.value) return (props.value as unknown[])[Number(k)];
  return (props.value as Record<string, unknown>)[k];
}

const valDisplay = computed((): string => {
  if (isNull.value) return 'null';
  if (typeof props.value === 'string') {
    const s = props.value;
    return `"${s.length > 300 ? s.slice(0, 300) + '…' : s}"`;
  }
  return String(props.value);
});

const valClass = computed(() => {
  if (isNull.value) return 'jtn-null';
  switch (typeof props.value) {
    case 'string':  return 'jtn-str';
    case 'number':  return 'jtn-num';
    case 'boolean': return props.value ? 'jtn-bool-t' : 'jtn-bool-f';
    default:        return 'jtn-null';
  }
});
</script>

<template>
  <div class="jtn-node">
    <!-- ── EMPTY object / array ───────────────────────────── -->
    <div v-if="isEmpty" class="jtn-row">
      <span class="jtn-sp" />
      <template v-if="label !== undefined">
        <span v-if="isArrayItem" class="jtn-idx">[{{ label }}]</span>
        <span v-else class="jtn-key">"{{ label }}"</span>
        <span class="jtn-p">:&nbsp;</span>
      </template>
      <span class="jtn-brkt">{{ openBr }}{{ closeBr }}</span>
      <span class="jtn-hint"> empty</span>
      <span v-if="trailingComma" class="jtn-p">,</span>
    </div>

    <!-- ── COLLAPSED expandable ───────────────────────────── -->
    <div
      v-else-if="isExpandable && !open"
      class="jtn-row jtn-clickable"
      role="button"
      tabindex="0"
      @click="open = true"
      @keydown.enter="open = true"
    >
      <span class="jtn-icon">▶</span>
      <template v-if="label !== undefined">
        <span v-if="isArrayItem" class="jtn-idx">[{{ label }}]</span>
        <span v-else class="jtn-key">"{{ label }}"</span>
        <span class="jtn-p">:&nbsp;</span>
      </template>
      <span class="jtn-brkt">{{ openBr }}</span>
      <span class="jtn-hint">&nbsp;{{ sizeHint }}&nbsp;</span>
      <span class="jtn-brkt">{{ closeBr }}</span>
      <span v-if="trailingComma" class="jtn-p">,</span>
    </div>

    <!-- ── EXPANDED expandable ────────────────────────────── -->
    <template v-else-if="isExpandable && open">
      <div
        class="jtn-row jtn-clickable"
        role="button"
        tabindex="0"
        @click="open = false"
        @keydown.enter="open = false"
      >
        <span class="jtn-icon">▼</span>
        <template v-if="label !== undefined">
          <span v-if="isArrayItem" class="jtn-idx">[{{ label }}]</span>
          <span v-else class="jtn-key">"{{ label }}"</span>
          <span class="jtn-p">:&nbsp;</span>
        </template>
        <span class="jtn-brkt">{{ openBr }}</span>
      </div>

      <div class="jtn-children">
        <JsonNode
          v-for="(k, i) in childKeys"
          :key="k"
          :value="childValue(k)"
          :label="k"
          :is-array-item="isArr"
          :depth="depth + 1"
          :max-depth="maxDepth"
          :trailing-comma="i < childKeys.length - 1"
        />
      </div>

      <div class="jtn-row">
        <span class="jtn-sp" />
        <span class="jtn-brkt">{{ closeBr }}</span>
        <span v-if="trailingComma" class="jtn-p">,</span>
      </div>
    </template>

    <!-- ── PRIMITIVE / null ───────────────────────────────── -->
    <div v-else class="jtn-row">
      <span class="jtn-sp" />
      <template v-if="label !== undefined">
        <span v-if="isArrayItem" class="jtn-idx">[{{ label }}]</span>
        <span v-else class="jtn-key">"{{ label }}"</span>
        <span class="jtn-p">:&nbsp;</span>
      </template>
      <span :class="valClass">{{ valDisplay }}</span>
      <span v-if="trailingComma" class="jtn-p">,</span>
    </div>
  </div>
</template>
