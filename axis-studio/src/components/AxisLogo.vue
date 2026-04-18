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
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="plasma-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7" />
        <stop offset="50%" stop-color="#ff2d78" />
        <stop offset="100%" stop-color="#06ffa5" />
      </linearGradient>
      <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#06ffa5" stop-opacity="0.3" />
      </linearGradient>
    </defs>

    <!-- Outer hexagonal ring -->
    <polygon
      points="50,6 88,27 88,73 50,94 12,73 12,27"
      fill="none"
      stroke="url(#ring-grad)"
      stroke-width="1.5"
      class="hex-ring hex-outer"
    />

    <!-- Inner hexagonal ring -->
    <polygon
      points="50,18 78,35 78,65 50,82 22,65 22,35"
      fill="none"
      stroke="url(#ring-grad)"
      stroke-width="1"
      class="hex-ring hex-inner"
      stroke-dasharray="8 4"
    />

    <!-- Orbital arcs -->
    <g class="orbital-arcs">
      <path
        d="M50 14 A36 36 0 0 1 86 50"
        stroke="#a855f7"
        stroke-width="2.5"
        fill="none"
        stroke-linecap="round"
        class="arc arc-1"
        filter="url(#logo-glow)"
      />
      <path
        d="M50 86 A36 36 0 0 1 14 50"
        stroke="#06ffa5"
        stroke-width="2.5"
        fill="none"
        stroke-linecap="round"
        class="arc arc-2"
        filter="url(#logo-glow)"
      />
      <path
        d="M86 50 A36 36 0 0 1 50 86"
        stroke="#ff2d78"
        stroke-width="1.5"
        fill="none"
        stroke-linecap="round"
        class="arc arc-3"
      />
    </g>

    <!-- Data flow lines — diagonal -->
    <g class="data-lines">
      <line x1="20" y1="30" x2="38" y2="44" class="flow-line fl-1" />
      <line x1="62" y1="56" x2="80" y2="70" class="flow-line fl-2" />
      <line x1="80" y1="30" x2="62" y2="44" class="flow-line fl-3" />
      <line x1="38" y1="56" x2="20" y2="70" class="flow-line fl-4" />
    </g>

    <!-- Core diamond -->
    <g class="core-group" filter="url(#logo-glow)">
      <polygon
        points="50,36 64,50 50,64 36,50"
        fill="none"
        stroke="url(#plasma-grad)"
        stroke-width="2.5"
        stroke-linejoin="round"
        class="core-diamond"
      />
      <!-- Inner cross -->
      <line
        x1="50"
        y1="40"
        x2="50"
        y2="60"
        stroke="#a855f7"
        stroke-width="1"
        opacity="0.5"
      />
      <line
        x1="40"
        y1="50"
        x2="60"
        y2="50"
        stroke="#a855f7"
        stroke-width="1"
        opacity="0.5"
      />
      <!-- Core nucleus -->
      <circle cx="50" cy="50" r="3" fill="#a855f7" class="core-nucleus" />
      <circle
        cx="50"
        cy="50"
        r="1.5"
        fill="#fff"
        opacity="0.9"
        class="core-dot"
      />
    </g>

    <!-- Satellite dots -->
    <circle
      cx="50"
      cy="6"
      r="2"
      fill="#a855f7"
      class="sat sat-1"
      opacity="0.7"
    />
    <circle
      cx="88"
      cy="50"
      r="1.5"
      fill="#06ffa5"
      class="sat sat-2"
      opacity="0.5"
    />
    <circle
      cx="50"
      cy="94"
      r="2"
      fill="#ff2d78"
      class="sat sat-3"
      opacity="0.6"
    />
    <circle
      cx="12"
      cy="50"
      r="1.5"
      fill="#a855f7"
      class="sat sat-4"
      opacity="0.4"
    />
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
    color: "var(--ax-primary)",
  },
);
</script>

<style scoped>
.axis-logo {
  flex-shrink: 0;
}

/* Hexagonal rings */
.hex-ring {
  opacity: 0.4;
}
.hex-outer {
  animation: hex-rotate 20s linear infinite;
  transform-origin: 50% 50%;
}
.hex-inner {
  animation: hex-rotate 14s linear infinite reverse;
  transform-origin: 50% 50%;
}

/* Orbital arcs */
.arc {
  animation: arc-spin 6s linear infinite;
  transform-origin: 50% 50%;
}
.arc-2 {
  animation-delay: -2s;
}
.arc-3 {
  animation-delay: -4s;
  animation-duration: 10s;
}

/* Data flow lines */
.flow-line {
  stroke: var(--ax-outline, #6b5f80);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 3 5;
  animation: flow-dash 2s linear infinite;
}
.fl-2 {
  animation-delay: -0.5s;
}
.fl-3 {
  animation-delay: -1s;
}
.fl-4 {
  animation-delay: -1.5s;
}

/* Core diamond */
.core-diamond {
  animation: core-breathe 3s ease-in-out infinite;
}

/* Core nucleus glow */
.core-nucleus {
  animation: nucleus-pulse 2s ease-in-out infinite;
}

/* Core center dot */
.core-dot {
  animation: dot-flicker 4s ease-in-out infinite;
}

/* Satellite dots */
.sat {
  animation: sat-blink 3s ease-in-out infinite;
}
.sat-2 {
  animation-delay: -0.8s;
}
.sat-3 {
  animation-delay: -1.6s;
}
.sat-4 {
  animation-delay: -2.4s;
}

@keyframes hex-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes arc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes flow-dash {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -16;
  }
}

@keyframes core-breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

@keyframes nucleus-pulse {
  0%,
  100% {
    opacity: 0.9;
    r: 3;
  }
  50% {
    opacity: 0.5;
    r: 4;
  }
}

@keyframes dot-flicker {
  0%,
  90%,
  100% {
    opacity: 0.9;
  }
  92% {
    opacity: 0.3;
  }
  94% {
    opacity: 0.9;
  }
  96% {
    opacity: 0.4;
  }
}

@keyframes sat-blink {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.9;
  }
}
</style>
