<template>
  <div class="h-full flex divide-x divide-white/5 bg-background font-body overflow-hidden">
    
    <!-- ══════ LEFT: EXECUTION FEED ══════════════════════ -->
    <div class="flex-1 flex flex-col min-w-0 bg-[#0A0C10]">
      
      <!-- Header Area -->
      <div class="p-8 pb-4 flex items-end justify-between">
        <div class="space-y-1">
          <h1 class="text-2xl font-headline font-black text-on-surface tracking-tight uppercase">
            Protocol <span class="text-[#00F5FF]">Audit</span> Feed
          </h1>
          <div class="flex items-center gap-3">
            <span class="px-2 py-0.5 bg-[#1A1C20] border border-white/5 font-mono text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
              {{ history.filtered.length }} SEQUENCES LOGGED
            </span>
            <div class="w-1 h-1 rounded-full bg-primary-container animate-pulse"></div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="relative group">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-on-surface-variant/30 group-focus-within:text-[#00F5FF] transition-colors">search</span>
            <input 
              v-model="history.filterQuery" 
              type="text" 
              placeholder="FILTER BY INTENT / EFFECT..."
              class="w-64 bg-[#111318] border border-white/5 px-10 py-2.5 font-mono text-[10px] text-[#00F5FF] focus:border-[#00F5FF]/30 focus:outline-none transition-all placeholder:text-on-surface-variant/20 uppercase tracking-wider"
            >
          </div>

          <button 
            v-if="history.entries.length"
            class="h-10 px-4 flex items-center gap-2 text-[10px] font-mono text-error/40 hover:text-error hover:bg-error/5 transition-all border border-transparent hover:border-error/20 uppercase tracking-widest"
            @click="confirmClear"
          >
            <span class="material-symbols-outlined text-sm">delete_sweep</span>
            PURGE
          </button>
        </div>
      </div>

      <!-- Feed Table Structure -->
      <div class="flex-1 flex flex-col min-h-0 px-8 pb-8">
        <div class="grid grid-cols-[48px_1fr_120px_100px_80px_48px] gap-4 py-4 border-b border-white/5 font-mono text-[9px] text-on-surface-variant/30 uppercase tracking-[0.2em] font-bold">
          <span class="text-center">ST</span>
          <span>DISPATCH_TARGET</span>
          <span>PROTOCOL_EFFECT</span>
          <span class="text-right">LATENCY</span>
          <span class="text-right">RESULT</span>
          <span></span>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.02]">
          <div 
            v-if="!history.filtered.length" 
            class="h-64 flex flex-col items-center justify-center opacity-20 border border-dashed border-white/5 mt-4"
          >
            <span class="material-symbols-outlined text-4xl mb-4">history</span>
            <p class="font-mono text-[10px] uppercase tracking-widest text-center">
              {{ history.entries.length ? 'ZERO CORRELATIONS MATCH FILTER' : 'AWAITING FIRST PROTOCOL DISPATCH' }}
            </p>
          </div>

          <div
            v-for="entry in history.filtered"
            :key="entry.id"
            class="grid grid-cols-[48px_1fr_120px_100px_80px_48px] gap-4 py-4 items-center cursor-pointer transition-all hover:bg-white/[0.02] border-l-2"
            :class="selectedId === entry.id ? 'bg-white/[0.03] border-[#00F5FF]' : 'border-transparent'"
            @click="selectedId = entry.id"
          >
             <!-- Status indicator -->
             <div class="flex justify-center">
               <div 
                 class="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                 :class="entry.status === 'ok' ? 'bg-primary-container shadow-primary-container/20' : 'bg-error shadow-error/20'"
               />
             </div>

             <!-- Intent + Metadata -->
             <div class="min-w-0 pr-4">
               <div class="font-mono text-xs font-bold text-on-surface truncate group-hover:text-[#00F5FF] transition-colors leading-none mb-1.5">
                 {{ entry.intent }}
               </div>
               <div class="flex items-center gap-2 font-mono text-[9px] text-on-surface-variant/30 whitespace-nowrap">
                 <span class="text-[#00F5FF]/40">{{ new Date(entry.ts).toLocaleTimeString() }}</span>
                 <span class="scale-50 opacity-20">/</span>
                 <span class="uppercase">ID: {{ entry.id.slice(0, 12) }}</span>
               </div>
             </div>

             <!-- Effect -->
             <div class="font-mono">
               <span v-if="entry.responseEffect" class="px-2 py-0.5 bg-white/5 border border-white/10 text-on-surface-variant/60 text-[9px] font-bold uppercase tracking-wider">
                 {{ entry.responseEffect }}
               </span>
               <span v-else class="text-on-surface-variant/10 font-mono text-[10px]">——</span>
             </div>

             <!-- Latency -->
             <div class="text-right">
               <span class="font-mono text-[10px] text-on-surface-variant/40">
                 {{ entry.durationMs }}<span class="text-[8px] opacity-50 ml-0.5">MS</span>
               </span>
             </div>

             <!-- Status code -->
             <div class="text-right">
               <span 
                 class="font-mono text-[10px] font-black uppercase tracking-tighter"
                 :class="entry.status === 'ok' ? 'text-primary-container' : 'text-error'"
               >
                 {{ entry.status === 'ok' ? '200_OK' : '500_ERR' }}
               </span>
             </div>

             <!-- Cleanup -->
             <button 
               class="flex justify-center text-on-surface-variant/20 hover:text-error transition-colors"
               @click.stop="history.remove(entry.id)"
             >
               <span class="material-symbols-outlined text-sm">close</span>
             </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ RIGHT: TRACE ANALYZER ════════════════════ -->
    <div
      v-if="selectedEntry"
      class="w-[440px] flex flex-col bg-background relative overflow-hidden"
    >
      <!-- Background Ornament -->
      <div class="absolute -top-24 -right-24 w-64 h-64 bg-[#00F5FF]/5 blur-[80px] rounded-full pointer-events-none"></div>

      <!-- Detail Header -->
      <div class="p-8 border-b border-white/5 space-y-4">
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <h2 class="text-xs font-mono font-bold text-[#00F5FF] uppercase tracking-[0.2em]">Transaction Trace</h2>
            <div class="text-lg font-headline font-black text-on-surface leading-tight break-all">{{ selectedEntry.intent }}</div>
          </div>
          <button 
            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-on-surface-variant/40 transition-colors"
            @click="selectedId = ''"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        
        <div class="flex items-center gap-6 py-2 border-y border-white/5">
          <div class="flex flex-col">
            <span class="font-mono text-[8px] text-on-surface-variant/40 uppercase tracking-widest">Protocol Node</span>
            <span class="font-mono text-[10px] text-on-surface">{{ selectedEntry.nodeUrl }}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-mono text-[8px] text-on-surface-variant/40 uppercase tracking-widest">Sequence TS</span>
            <span class="font-mono text-[10px] text-on-surface">{{ new Date(selectedEntry.ts).toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Trace Visualizer -->
      <div class="p-8 space-y-6 flex-shrink-0">
        <div
          v-for="(step, i) in traceSteps"
          :key="i"
          class="flex gap-4 group"
        >
          <div class="flex flex-col items-center gap-1">
            <div 
              class="w-3 h-3 rounded-full border-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all group-hover:scale-125" 
              :style="{ background: step.color }"
            />
            <div v-if="i < traceSteps.length - 1" class="w-0.5 flex-1 bg-white/5 group-hover:bg-[#00F5FF]/20 transition-colors min-h-[20px]"></div>
          </div>
          <div class="pb-6">
            <div class="text-[10px] font-mono font-bold text-on-surface uppercase tracking-widest mb-1">{{ step.label }}</div>
            <div class="text-[11px] font-mono text-on-surface-variant/40 leading-relaxed">{{ step.detail }}</div>
          </div>
        </div>
      </div>

      <!-- Payload Inspect -->
      <div class="flex-1 flex flex-col min-h-0 bg-[#0A0C10]/50 border-t border-white/5">
        <div class="flex items-center px-8 bg-black/20 border-b border-white/5">
           <button 
              v-for="tab in (['response', 'request'] as const)" 
              :key="tab"
              class="px-4 py-3 text-[9px] font-mono uppercase tracking-[0.2em] transition-all relative"
              :class="(detailTabs[selectedEntry.id] || 'response') === tab ? 'text-[#00F5FF] font-black' : 'text-on-surface-variant/30 hover:text-on-surface'"
              @click="detailTabs[selectedEntry.id] = tab"
            >
              {{ tab }}
              <div v-if="(detailTabs[selectedEntry.id] || 'response') === tab" class="absolute bottom-0 left-0 w-full h-0.5 bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]"></div>
            </button>
        </div>

        <div class="flex-1 overflow-hidden relative">
          <JsonTree
            :value="parseSafe((detailTabs[selectedEntry.id] || 'response') === 'response' ? selectedEntry.responseBody : selectedEntry.requestBody)"
            class="h-full border-none"
          />
        </div>
      </div>
    </div>

    <!-- Empty State Analysis -->
    <div v-else class="flex-1 flex flex-col items-center justify-center bg-background/50 group select-none overflow-hidden">
       <div class="relative">
         <div class="absolute inset-0 bg-[#00F5FF]/5 blur-3xl rounded-full scale-150 animate-pulse"></div>
         <span class="material-symbols-outlined text-[120px] text-[#00F5FF]/10 relative group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">query_stats</span>
       </div>
       <h3 class="text-xs font-mono font-bold text-on-surface-variant/20 uppercase tracking-[0.4em] mt-8">Sequential Correlation Engine</h3>
       <p class="text-[10px] font-mono text-on-surface-variant/10 uppercase tracking-[0.2em] mt-2">Select an entry from the feed to analyze metadata</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useQuasar } from 'quasar';
import JsonTree from 'src/components/JsonTree.vue';
import { useHistoryStore } from 'stores/history';

const $q = useQuasar();
const history = useHistoryStore();

const selectedId = ref('');
const detailTabs = reactive<Record<string, string>>({});

const selectedEntry = computed(() =>
  history.filtered.find(e => e.id === selectedId.value) ?? null,
);

const traceSteps = computed(() => {
  if (!selectedEntry.value) return [];
  const e = selectedEntry.value;
  return [
    { label: 'Intent Dispatch', detail: `Encapsulated binary frame broadcast to protocol cluster.`, color: '#00F5FF' },
    { label: 'Network Resolution', detail: `Route established within ${e.durationMs}ms with active chain synchronization.`, color: '#00F5FF' },
    { label: 'Execution Finality', detail: e.status === 'ok' ? 'Positive confirmation receipt acknowledged.' : 'Terminal error state encountered during processing.', color: e.status === 'ok' ? '#00F5FF' : '#FF4B4B' },
    ...(e.responseEffect ? [{ label: 'Side Effect Logged', detail: `State transition recorded as: ${e.responseEffect}`, color: '#00F5FF' }] : []),
  ];
});

function parseSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function confirmClear() {
  $q.dialog({
    title: 'Purge Logs',
    message: 'Are you sure you want to delete all historical sequence logs? This action is IRREVERSIBLE.',
    cancel: { flat: true, color: 'on-surface' },
    ok: { label: 'CONFIRM PURGE', color: 'error', flat: true },
    persistent: true,
  }).onOk(() => {
     history.clear();
     selectedId.value = '';
  });
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 245, 255, 0.2);
}
</style>
