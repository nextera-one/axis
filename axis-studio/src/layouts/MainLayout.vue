<template>
  <div class="h-screen w-full bg-background text-on-surface font-body overflow-hidden flex">
    <!-- ═══════ SIDEBAR ════════════════════════════════════════ -->
    <aside class="w-64 border-r border-white/5 bg-[#111318] flex flex-col z-50 shadow-[4px_0_24px_rgba(0,245,255,0.05)] font-headline tracking-tight">
      <div class="p-6">
        <div class="text-lg font-bold tracking-widest text-[#E1E4E8]">AXIS STUDIO</div>
        <div class="text-[10px] text-primary-container/60 font-mono mt-1">V1.0.4-BETA</div>
      </div>

      <nav class="flex-1 px-3 space-y-1">
        <router-link
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          class="flex items-center gap-3 px-4 py-3 transition-colors duration-200 active:scale-[0.99]"
          :class="[
            route.path.startsWith(nav.to) 
              ? 'text-[#00F5FF] bg-[#1A1C20] border-r-2 border-[#00F5FF]' 
              : 'text-[#E1E4E8]/60 hover:text-[#E1E4E8] hover:bg-[#1E2024]'
          ]"
        >
          <span class="material-symbols-outlined" :style="route.path.startsWith(nav.to) ? 'font-variation-settings: \'FILL\' 1' : ''">{{ nav.icon }}</span>
          <span>{{ nav.label }}</span>
        </router-link>
      </nav>

      <div class="p-4 mt-auto border-t border-white/5">
        <div 
          class="flex items-center gap-3 px-4 py-3 text-[#E1E4E8]/60 hover:text-[#E1E4E8] cursor-pointer"
          @click="showConn = true"
        >
          <span class="material-symbols-outlined">settings</span>
          <span>Settings</span>
        </div>
        <div class="flex items-center gap-3 px-4 py-3 text-[#E1E4E8]/60 hover:text-[#E1E4E8] cursor-pointer">
          <span 
            class="material-symbols-outlined"
            :class="conn.connected ? 'text-[#00F5FF]' : 'text-error'"
          >sensors</span>
          <span>Status</span>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col relative min-w-0">
      <!-- ═══════ TOP BAR ════════════════════════════════════════ -->
      <header class="flex items-center justify-between px-6 h-12 z-40 bg-[#0A0C10]/80 backdrop-blur-md border-b border-white/5 font-mono text-xs uppercase tracking-widest">
        <div class="flex items-center gap-8 flex-1">
          <div class="relative w-64 group">
            <span class="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/40 scale-75">search</span>
            <input
              v-model="searchQuery"
              class="bg-transparent border-none focus:ring-0 pl-8 w-full text-[10px] text-on-surface placeholder:text-on-surface-variant/30"
              placeholder="QUERY PROTOCOL..."
              type="text"
              @keyup.enter="searchProtocol"
            />
          </div>
          <nav class="flex items-center gap-6">
            <a class="text-[#E1E4E8]/50 hover:text-[#00F5FF] transition-all cursor-pointer" @click="router.push('/registry')">Intents</a>
            <a class="text-[#E1E4E8]/50 hover:text-[#00F5FF] transition-all cursor-pointer" @click="router.push('/auth')">Actors</a>
            <a class="text-[#E1E4E8]/50 hover:text-[#00F5FF] transition-all cursor-pointer" @click="router.push('/history')">Proofs</a>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <span class="material-symbols-outlined text-[#E1E4E8]/50 hover:text-[#00F5FF] cursor-pointer scale-90" title="Network" @click="router.push('/registry')">hub</span>
          <span class="material-symbols-outlined text-[#E1E4E8]/50 hover:text-[#00F5FF] cursor-pointer scale-90" title="Security" @click="router.push('/auth')">security</span>
          <span 
            class="material-symbols-outlined text-[#E1E4E8]/50 hover:text-[#00F5FF] cursor-pointer scale-90" 
            @click="toggleDark"
          >{{ $q.dark.isActive ? 'light_mode' : 'dark_mode' }}</span>
          <button 
            class="bg-primary-container text-on-primary-fixed px-4 py-1 font-bold text-[10px] hover:opacity-80 active:scale-95 transition-all"
            @click="showConn = true"
          >
            {{ conn.connected ? 'Connected' : 'Connect' }}
          </button>
        </div>
      </header>

      <!-- ═══════ PAGE CONTENT ═══════════════════════════════════ -->
      <main class="flex-1 overflow-y-auto custom-scrollbar pt-2 pb-8">
        <router-view v-slot="{ Component, route: r }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" :key="r.path" />
          </transition>
        </router-view>
      </main>

      <!-- ═══════ BOTTOM STATUS BAR ═════════════════════════════ -->
      <footer class="flex items-center justify-start px-4 gap-8 h-8 z-50 bg-[#111318] border-t border-white/5 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] font-mono text-[10px] uppercase">
        <div 
          class="flex items-center gap-2 cursor-pointer transition-colors"
          :class="conn.connected ? 'text-[#E1E4E8]/60 hover:text-[#E1E4E8]' : 'text-error/60'"
        >
          <span class="material-symbols-outlined scale-75">speed</span>
          <span>Latency: {{ conn.latencyMs != null ? conn.latencyMs + 'ms' : '—' }}</span>
        </div>
        <div class="flex items-center gap-2 text-[#00F5FF] font-bold cursor-pointer">
          <span class="material-symbols-outlined scale-75">straighten</span>
          <span>Frame: {{ conn.connected ? 'Secured' : 'N/A' }}</span>
        </div>
        <div class="flex items-center gap-2 text-[#E1E4E8]/40 hover:text-[#E1E4E8] cursor-pointer">
          <span class="material-symbols-outlined scale-75">verified_user</span>
          <span>Valid: {{ conn.connected ? '100%' : '—' }}</span>
        </div>
        <div class="flex items-center gap-2 text-[#E1E4E8]/40 hover:text-[#E1E4E8] cursor-pointer">
          <span class="material-symbols-outlined scale-75">terminal</span>
          <span>Result: {{ conn.connected ? 'Success' : 'N/A' }}</span>
        </div>
        <div class="ml-auto pr-4 text-[9px] text-on-surface-variant/30 flex items-center gap-2">
          <span 
            class="w-1.5 h-1.5 rounded-full"
            :class="conn.connected ? 'bg-primary-container animate-pulse' : 'bg-error'"
          ></span>
          {{ conn.connected ? 'LIVE_PROTOCOL_FEED' : 'DISCONNECTED' }}
        </div>
      </footer>
    </div>

    <!-- ═══════ CONNECTION DIALOG ══════════════════════════════ -->
    <q-dialog v-model="showConn">
      <q-card
        style="
          min-width: 380px;
          max-width: 96vw;
          background: var(--ax-surface);
          border: 1px solid var(--ax-border);
        "
      >
        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 16px 10px;
            border-bottom: 1px solid var(--ax-border);
          "
        >
          <AxisLogo :size="24" />
          <span
            class="font-headline"
            style="
              font-size: 0.9rem;
              font-weight: 600;
              color: var(--ax-on-surface);
            "
            >Node Connection</span
          >
          <q-space />
          <q-btn
            flat
            round
            dense
            icon="close"
            v-close-popup
            size="xs"
            style="color: var(--ax-outline)"
          />
        </div>

        <div style="padding: 14px 16px">
          <q-input
            v-model="tempUrl"
            label="AXIS Node URL"
            outlined
            dense
            placeholder="http://localhost:4747/axis"
            @keyup.enter="applyConn"
          >
            <template #prepend>
              <q-icon name="api" size="15px" />
            </template>
          </q-input>

          <div
            style="
              display: flex;
              align-items: center;
              gap: 6px;
              margin-top: 10px;
            "
          >
            <span
              class="material-symbols-outlined"
              :style="{
                fontSize: '16px',
                color: conn.connected
                  ? 'var(--ax-ok)'
                  : conn.lastError
                    ? 'var(--ax-error)'
                    : 'var(--ax-outline)',
              }"
            >
              {{
                conn.connected
                  ? 'check_circle'
                  : conn.lastError
                    ? 'cancel'
                    : 'help_outline'
              }}
            </span>
            <span style="font-size: 0.76rem; color: var(--ax-outline)">{{
              conn.statusLabel
            }}</span>
            <q-spinner v-if="conn.pinging" size="12px" color="primary" />
          </div>
        </div>

        <div
          style="
            display: flex;
            justify-content: flex-end;
            gap: 6px;
            padding: 8px 14px 14px;
          "
        >
          <q-btn
            flat
            label="Cancel"
            v-close-popup
            size="sm"
            style="color: var(--ax-outline)"
          />
          <q-btn
            flat
            color="info"
            label="Test"
            :loading="conn.pinging"
            @click="conn.ping()"
            size="sm"
          />
          <q-btn
            unelevated
            color="primary"
            label="Save"
            @click="applyConn"
            size="sm"
          />
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useConnectionStore } from 'stores/connection';
import AxisLogo from 'src/components/AxisLogo.vue';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const conn = useConnectionStore();

const showConn = ref(false);
const tempUrl = ref(conn.nodeUrl);
const searchQuery = ref('');

function searchProtocol() {
  const q = searchQuery.value.trim();
  if (q) {
    router.push({ path: '/registry', query: { q } });
    searchQuery.value = '';
  }
}

const navItems = [
  { label: 'Sender', icon: 'send', to: '/sender' },
  { label: 'Registry', icon: 'database', to: '/registry' },
  { label: 'Auth', icon: 'key', to: '/auth' },
  { label: 'History', icon: 'history', to: '/history' },
];

function toggleDark() {
  $q.dark.toggle();
  localStorage.setItem('axis_dark_mode', String($q.dark.isActive));
}

function applyConn() {
  conn.setNodeUrl(tempUrl.value);
  conn.ping();
  showConn.value = false;
}

conn.ping();
</script>
