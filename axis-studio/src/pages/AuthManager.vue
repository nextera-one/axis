<template>
  <div class="h-full flex flex-col bg-background font-body overflow-y-auto custom-scrollbar">
    
    <!-- ══════ HERO / IDENTITY HEADER ══════════════════ -->
    <div class="p-8 pb-4 border-b border-white/5 bg-[#111318]/50 backdrop-blur-sm sticky top-0 z-10">
      <div class="flex items-end justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-headline font-black text-on-surface tracking-tight uppercase leading-none">
            Identity <span class="text-[#00F5FF]">Vault</span>
          </h1>
          <p class="font-mono text-[10px] text-on-surface-variant/40 tracking-[0.3em] uppercase">
            Protocol Signing Engine & Actor Context
          </p>
        </div>
        
        <div class="flex items-center gap-6 pb-1">
          <div v-for="stat in stats" :key="stat.label" class="flex flex-col items-end">
            <span class="font-mono text-[8px] text-on-surface-variant/40 uppercase tracking-widest">{{ stat.label }}</span>
            <span class="font-mono text-sm text-[#00F5FF] font-bold">{{ stat.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ MAIN CONTENT GRID ══════════════════════ -->
    <div class="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      
      <!-- LEFT COLUMN: CONTEXT & KEYS LIST -->
      <div class="space-y-8">
        
        <!-- Actor Context Panel -->
        <div class="bg-[#0A0C10] border border-white/5 relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-1 h-full bg-[#00F5FF]/20 group-hover:bg-[#00F5FF] transition-all"></div>
          <div class="p-6">
            <div class="flex items-center gap-3 mb-6">
              <span class="material-symbols-outlined text-sm text-[#00F5FF]">badge</span>
              <h3 class="text-xs font-mono font-bold text-on-surface uppercase tracking-[0.2em]">Actor Context</h3>
            </div>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest ml-1">Universal Actor ID</label>
                <input 
                  :value="auth.actorId" 
                  type="text" 
                  placeholder="actor:anonymous_..."
                  class="w-full bg-[#111318] border border-white/10 px-4 py-3 font-mono text-xs text-on-surface focus:border-[#00F5FF]/40 focus:outline-none transition-all placeholder:text-on-surface-variant/10"
                  @input="(e) => auth.setActorId((e.target as HTMLInputElement).value)"
                >
              </div>
              
              <div class="space-y-2">
                <label class="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest ml-1">Capsule Binding GUID</label>
                <input 
                  :value="auth.capsuleId" 
                  type="text" 
                  placeholder="OPTIONAL_BINDING_ID..."
                  class="w-full bg-[#111318] border border-white/10 px-4 py-3 font-mono text-xs text-on-surface focus:border-[#00F5FF]/40 focus:outline-none transition-all placeholder:text-on-surface-variant/10"
                  @input="(e) => auth.setCapsuleId((e.target as HTMLInputElement).value)"
                >
              </div>
            </div>
            
            <p class="mt-6 text-[10px] text-on-surface-variant/30 font-mono italic leading-relaxed">
              * Context is automatically injected into binary frame headers during dispatch.
            </p>
          </div>
        </div>

        <!-- Signing Keys Panel -->
        <div class="bg-[#0A0C10] border border-white/5 relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-1 h-full bg-white/5 group-hover:bg-[#00F5FF]/30 transition-all"></div>
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-sm text-[#00F5FF]">key</span>
                <h3 class="text-xs font-mono font-bold text-on-surface uppercase tracking-[0.2em]">Ed25519 Keyrings</h3>
              </div>
              <button 
                class="flex items-center gap-2 px-3 py-1.5 bg-[#1A1C20] border border-white/10 text-[9px] font-mono text-on-surface-variant/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/30 transition-all uppercase tracking-widest"
                :disabled="generating"
                @click="generateKey"
              >
                <q-spinner v-if="generating" size="10px" />
                <span v-else class="material-symbols-outlined text-xs">add</span>
                GENERATE NEW
              </button>
            </div>
            
            <div class="space-y-2 divide-y divide-white/[0.03]">
              <div 
                v-for="k in auth.keys" 
                :key="k.id"
                class="py-3 flex items-center justify-between group/row cursor-pointer transition-all"
                :class="auth.activeKeyId === k.id ? 'opacity-100' : 'opacity-40 hover:opacity-70'"
                @click="auth.setActive(k.id)"
              >
                <div class="flex items-center gap-4">
                  <div class="w-1.5 h-1.5 rounded-full" :class="auth.activeKeyId === k.id ? 'bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]' : 'bg-white/10'"></div>
                  <div class="min-w-0">
                    <div class="font-mono text-xs font-bold text-on-surface group-hover/row:text-[#00F5FF] transition-colors uppercase leading-none mb-1">
                      {{ k.label }}
                    </div>
                    <div class="font-mono text-[9px] text-on-surface-variant/30 truncate max-w-[200px]">
                      {{ k.publicKeyHex }}
                    </div>
                  </div>
                </div>
                
                <button 
                  class="p-2 text-on-surface-variant/20 hover:text-error transition-colors"
                  @click.stop="auth.removeKey(k.id)"
                >
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
              
              <div v-if="!auth.keys.length" class="py-12 flex flex-col items-center justify-center opacity-10">
                <span class="material-symbols-outlined text-4xl mb-2">lock_open</span>
                <p class="font-mono text-[10px] uppercase tracking-widest">Vault is empty</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: ACTIVE KEY DETAIL -->
      <div class="space-y-8">
        <div v-if="activeKey" class="bg-[#111318] border border-white/5 relative overflow-hidden h-full min-h-[500px] flex flex-col">
          <div class="absolute -top-32 -right-32 w-64 h-64 bg-[#00F5FF]/5 blur-[100px] rounded-full"></div>
          
          <div class="p-8 border-b border-white/5 flex items-center justify-between relative z-10">
             <div class="space-y-1">
               <span class="text-[9px] font-mono text-[#00F5FF] uppercase tracking-[0.3em]">Operational Key</span>
               <h2 class="text-xl font-headline font-black text-on-surface tracking-tight uppercase">{{ activeKey.label }}</h2>
             </div>
             <button 
               @click="copyPub"
               class="px-3 py-1.5 border border-[#00F5FF]/20 text-[9px] font-mono text-[#00F5FF] hover:bg-[#00F5FF]/10 transition-all uppercase tracking-widest"
             >
               COPY_PUB_KEY
             </button>
          </div>

          <div class="p-8 space-y-8 relative z-10 flex-1">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">Public Key Descriptor</label>
                <div class="p-4 bg-black/40 border border-white/5 font-mono text-[11px] text-on-surface break-all leading-relaxed shadow-inner select-all">
                  {{ activeKey.publicKeyHex }}
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">Private Key Scalar</label>
                  <button 
                    @click="showPrivate = !showPrivate"
                    class="text-[9px] font-mono text-on-surface-variant/40 hover:text-on-surface transition-colors uppercase tracking-tighter"
                  >
                    {{ showPrivate ? 'CONCEAL' : 'REVEAL' }}
                  </button>
                </div>
                <div class="p-4 bg-black/40 border border-white/5 font-mono text-[11px] text-on-surface break-all leading-relaxed shadow-inner">
                  <template v-if="showPrivate">{{ activeKey.privateKeyHex }}</template>
                  <template v-else>
                    <span class="opacity-20">{{ '•'.repeat(64) }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 bg-white/[0.02] border border-white/5">
                <span class="block font-mono text-[8px] text-on-surface-variant/40 uppercase tracking-widest mb-1">Created Epoch</span>
                <span class="block font-mono text-[10px] text-on-surface">{{ new Date(activeKey.createdAt).toLocaleString() }}</span>
              </div>
              <div class="p-4 bg-white/[0.02] border border-white/5">
                <span class="block font-mono text-[8px] text-on-surface-variant/40 uppercase tracking-widest mb-1">Algorithm</span>
                <span class="block font-mono text-[10px] text-on-surface">ED25519_CORE_V1</span>
              </div>
            </div>
            
            <div class="p-6 bg-[#00F5FF]/5 border border-[#00F5FF]/10 space-y-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-xs text-[#00F5FF]">verified_user</span>
                <span class="font-mono text-[10px] font-bold text-[#00F5FF] uppercase tracking-widest">Protocol Usage</span>
              </div>
              <p class="text-[10px] font-mono text-on-surface-variant/60 leading-relaxed uppercase">
                THIS KEY IS ACTIVELY INTERCEPTING OUTBOUND INTENT FRAMES. ALL CRYPTOGRAPHIC SIGS ARE COMPUTED LOCALLY IN-VOLATILE MEMORY.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Empty State active details -->
        <div v-else class="h-full flex flex-col items-center justify-center border border-dashed border-white/5 opacity-20 group">
           <span class="material-symbols-outlined text-6xl group-hover:scale-110 transition-transform duration-700">key_off</span>
           <p class="font-mono text-[10px] uppercase tracking-[0.4em] mt-4">No Active Key Loaded</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAuthStore } from 'stores/auth';

const $q   = useQuasar();
const auth = useAuthStore();

const generating  = ref(false);
const showPrivate = ref(false);

const activeKey = computed(() => auth.getActiveKey());

const stats = computed(() => [
  { label: 'KEYS LOADED', value: auth.keys.length },
  { label: 'ACTIVE_KEY', value: activeKey.value ? activeKey.value.label : 'NULL' },
  { label: 'ACTOR_ID', value: auth.actorId ? 'SET' : 'LOCAL_ANON' }
]);

async function generateKey() {
  generating.value = true;
  try {
    const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const privRaw = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
    const pubRaw  = await crypto.subtle.exportKey('raw',   kp.publicKey);

    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    auth.addKey({
      id:            crypto.randomUUID(),
      label:         'SEQUENCE_KEY_' + (auth.keys.length + 1),
      privateKeyHex: toHex(privRaw),
      publicKeyHex:  toHex(pubRaw),
      createdAt:     Date.now(),
    });

    $q.notify({ message: 'AUTHENTICATION_KEY_ROTATED_SUCCESS', icon: 'verified', color: 'positive', timeout: 2000 });
  } finally {
    generating.value = false;
  }
}

async function copyPub() {
  if (!activeKey.value) return;
  try {
    await navigator.clipboard.writeText(activeKey.value.publicKeyHex);
    $q.notify({ message: 'PUBLIC_KEY_COPIED_TO_CLIPBOARD', icon: 'content_copy', color: 'positive', timeout: 1200 });
  } catch {
    $q.notify({ message: 'CLIPBOARD_ACCESS_DENIED', color: 'negative', timeout: 1200 });
  }
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
