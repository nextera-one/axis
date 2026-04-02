<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    class="axis-logo"
  >
    <defs>
      <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Outer orbital rings -->
    <g class="outer-rings">
      <path
        d="M50 10 A40 40 0 0 1 90 50"
        :stroke="color"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
        class="ring-segment segment-1"
      />
      <path
        d="M50 90 A40 40 0 0 1 10 50"
        :stroke="color"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
        class="ring-segment segment-2"
      />
    </g>

    <!-- Corner brackets -->
    <g class="brackets">
      <path d="M35 40 L35 35 L40 35" class="bracket tl" />
      <path d="M65 40 L65 35 L60 35" class="bracket tr" />
      <path d="M35 60 L35 65 L40 65" class="bracket bl" />
      <path d="M65 60 L65 65 L60 65" class="bracket br" />
    </g>

    <!-- Data flow lines -->
    <g class="data-lines">
      <line x1="15" y1="50" x2="35" y2="50" class="flow-line left" />
      <line x1="65" y1="50" x2="85" y2="50" class="flow-line right" />
    </g>

    <!-- Core square + dot -->
    <g class="core-group">
      <rect
        x="42"
        y="42"
        width="16"
        height="16"
        class="logo-core"
        fill="none"
        :stroke="color"
        stroke-width="3"
        filter="url(#logo-glow)"
      />
      <circle cx="50" cy="50" r="2" :fill="color" class="core-dot" />
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
    color?: string;
  }>(),
  {
    size: 32,
    color: 'var(--ax-primary)',
  },
);
</script>

<style scoped>
.axis-logo {
  flex-shrink: 0;
}

/* Brackets */
.bracket {
  fill: none;
  stroke: var(--ax-on-surface-variant, #b9caca);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Data flow lines */
.flow-line {
  stroke: var(--ax-outline, #849495);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 4 4;
}

/* Ring animation */
.ring-segment {
  animation: ring-spin 8s linear infinite;
  transform-origin: 50% 50%;
}
.segment-2 {
  animation-delay: -4s;
}

/* Core pulse */
.core-dot {
  animation: core-pulse 2s ease-in-out infinite;
}

@keyframes ring-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes core-pulse {
  0%,
  100% {
    opacity: 1;
    r: 2;
  }
  50% {
    opacity: 0.6;
    r: 3;
  }
}
</style>
