<template>
  <div class="h-full flex flex-col items-center justify-center bg-background font-body relative overflow-hidden">
    <!-- Background Glow -->
    <div class="absolute inset-0 bg-[#00F5FF]/5 blur-[120px] rounded-full scale-150 animate-pulse pointer-events-none"></div>
    
    <div class="relative z-10 text-center space-y-8">
      <div class="space-y-2">
        <h1 class="text-8xl font-headline font-black text-on-surface tracking-tighter uppercase leading-none italic">
          <span class="text-[#00F5FF]">404</span>_FAULT
        </h1>
        <p class="font-mono text-[10px] text-on-surface-variant/40 tracking-[0.4em] uppercase">
          Protocol Endpoint Not Found
        </p>
      </div>

      <div class="max-w-xs mx-auto text-[11px] font-mono text-on-surface-variant/60 leading-relaxed uppercase">
        THE REQUESTED RESOURCE HAS BEEN DEPRECATED OR DOES NOT EXIST WITHIN THE ACTIVE CLUSTER NAMESPACE.
      </div>

      <router-link 
        to="/" 
        class="inline-block px-8 py-3 bg-primary-container text-on-primary-fixed font-headline font-black text-[11px] uppercase tracking-[0.2em] hover:bg-[#00F5FF] hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all active:scale-95"
      >
        RETURN_TO_GATEWAY
      </router-link>
    </div>

    <!-- UI Ornament -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[8px] text-on-surface-variant/10 uppercase tracking-[0.5em] whitespace-nowrap">
      AXIS_STUDIO // PROTOCOL_READY // {{ new Date().getFullYear() }}
    </div>
  </div>
</template>

<script setup lang="ts">
// No logic needed
</script>
