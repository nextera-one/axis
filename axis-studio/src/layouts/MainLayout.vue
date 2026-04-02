<template>
  <div class="ax-layout">
    <!-- ═══════ SIDEBAR ════════════════════════════════════════ -->
    <aside class="ax-sidebar">
      <div class="ax-sidebar-brand">
        <div style="display: flex; align-items: center; gap: 10px">
          <AxisLogo :size="34" />
          <div>
            <div class="ax-sidebar-title">AXIS STUDIO</div>
            <div class="ax-sidebar-version">V1.0.4-BETA</div>
          </div>
        </div>
      </div>

      <nav class="ax-sidebar-nav">
        <router-link
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          class="ax-nav-link"
          :class="{ 'ax-nav-link--active': route.path === nav.to }"
        >
          <span class="material-symbols-outlined">{{ nav.icon }}</span>
          <span>{{ nav.label }}</span>
        </router-link>
      </nav>

      <div class="ax-sidebar-bottom">
        <div
          class="ax-nav-link"
          style="padding: 8px 16px"
          @click="showConn = true"
        >
          <span class="material-symbols-outlined">settings</span>
          <span style="font-size: 0.75rem">Settings</span>
        </div>
        <div class="ax-nav-link" style="padding: 8px 16px">
          <span
            class="material-symbols-outlined"
            :style="{
              color: conn.connected ? 'var(--ax-ok)' : 'var(--ax-error)',
            }"
            >sensors</span
          >
          <span style="font-size: 0.75rem">
            {{ conn.connected ? 'Online' : 'Offline' }}
          </span>
        </div>
      </div>
    </aside>

    <!-- ═══════ TOP BAR ════════════════════════════════════════ -->
    <header class="ax-topbar">
      <div style="display: flex; align-items: center; gap: 32px; flex: 1">
        <div class="ax-topbar-search">
          <span class="material-symbols-outlined">search</span>
          <input placeholder="QUERY PROTOCOL..." type="text" />
        </div>
        <nav class="ax-topbar-nav">
          <a @click.prevent>Intents</a>
          <a @click.prevent>Actors</a>
          <a @click.prevent>Proofs</a>
        </nav>
      </div>

      <div class="ax-topbar-actions">
        <button class="ax-topbar-icon" title="Network">
          <span class="material-symbols-outlined">hub</span>
        </button>
        <button class="ax-topbar-icon" title="Security">
          <span class="material-symbols-outlined">security</span>
        </button>
        <button
          class="ax-topbar-icon"
          :title="$q.dark.isActive ? 'Light mode' : 'Dark mode'"
          @click="toggleDark"
        >
          <span class="material-symbols-outlined">{{
            $q.dark.isActive ? 'light_mode' : 'dark_mode'
          }}</span>
        </button>
        <button class="ax-connect-btn" @click="showConn = true">
          {{ conn.connected ? 'Connected' : 'Connect' }}
        </button>
      </div>
    </header>

    <!-- ═══════ PAGE CONTENT ═══════════════════════════════════ -->
    <main class="ax-page-container">
      <router-view v-slot="{ Component, route: r }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="r.path" />
        </transition>
      </router-view>
    </main>

    <!-- ═══════ BOTTOM STATUS BAR ═════════════════════════════ -->
    <footer class="ax-statusbar">
      <div
        class="ax-status-item"
        :class="{ 'ax-status-item--active': conn.connected }"
      >
        <span class="material-symbols-outlined">speed</span>
        <span
          >Latency:
          {{ conn.latencyMs != null ? conn.latencyMs + 'ms' : '—' }}</span
        >
      </div>
      <div
        class="ax-status-item"
        :class="{ 'ax-status-item--active': conn.connected }"
      >
        <span class="material-symbols-outlined">straighten</span>
        <span>Frame: {{ conn.connected ? 'Secured' : 'N/A' }}</span>
      </div>
      <div class="ax-status-item">
        <span class="material-symbols-outlined">verified_user</span>
        <span>Valid: {{ conn.connected ? '100%' : '—' }}</span>
      </div>
      <div class="ax-status-item">
        <span class="material-symbols-outlined">terminal</span>
        <span>Result: {{ conn.connected ? 'Success' : 'N/A' }}</span>
      </div>
      <div class="ax-status-live">
        <span class="ax-pulse-dot"></span>
        {{ conn.connected ? 'LIVE_PROTOCOL_FEED' : 'DISCONNECTED' }}
      </div>
    </footer>

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
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useConnectionStore } from 'stores/connection';
import AxisLogo from 'src/components/AxisLogo.vue';

const $q = useQuasar();
const route = useRoute();
const conn = useConnectionStore();

const showConn = ref(false);
const tempUrl = ref(conn.nodeUrl);

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
