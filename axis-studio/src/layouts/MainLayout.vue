<template>
  <q-layout view="lHh LpR lFf">

    <!-- ═══════ TOP BAR — Frosted glass ═══════════════════════════════════ -->
    <q-header elevated class="ax-header">
      <q-toolbar style="min-height: 52px">
        <q-btn
          flat dense round
          aria-label="Toggle menu"
          icon="menu"
          @click="drawer = !drawer"
          class="q-mr-sm"
        />

        <!-- Brand mark with gradient text -->
        <div class="row items-center no-wrap q-mr-md" style="gap: 6px; cursor: default">
          <div class="ax-logo-icon">
            <q-icon name="hexagon" size="22px" />
          </div>
          <span class="ax-brand-text">AXIS</span>
          <span class="text-weight-regular" style="font-size: 0.85rem; color: var(--ax-text-dim)">
            Studio
          </span>
        </div>

        <!-- Page title (md+) -->
        <div class="gt-sm row items-center no-wrap" style="gap: 8px">
          <div style="width: 1px; height: 16px; background: var(--ax-border)" />
          <span style="font-size: 0.78rem; font-weight: 500; color: var(--ax-text-muted)">
            {{ currentTitle }}
          </span>
        </div>

        <q-space />

        <!-- Connection status pill -->
        <div
          class="ax-conn-chip"
          :class="conn.connected ? 'ax-conn-chip--connected' : 'ax-conn-chip--disconnected'"
          @click="showConn = true"
        >
          <span class="ax-dot" :class="{ 'ax-dot--pulse': conn.connected }" />
          <span class="gt-xs font-mono">
            {{ conn.connected ? conn.latencyMs + 'ms' : 'Offline' }}
          </span>
        </div>

        <!-- Dark / light toggle -->
        <q-btn
          flat dense round
          class="q-ml-sm"
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :title="$q.dark.isActive ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDark"
        />
      </q-toolbar>
    </q-header>

    <!-- ═══════ LEFT DRAWER — Glass nav ═══════════════════════════════════ -->
    <q-drawer
      v-model="drawer"
      :width="236"
      :breakpoint="700"
      bordered
      class="ax-drawer"
    >
      <div class="q-pa-md q-pb-xs">
        <div
          style="font-size: 0.6rem; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase"
          :style="{ color: 'var(--ax-text-dim)' }"
        >
          Navigation
        </div>
      </div>

      <q-list dense class="q-px-sm q-mt-xs">
        <q-item
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          clickable
          v-ripple
          active-class="nav-active"
          class="nav-item q-mb-xs"
        >
          <q-item-section avatar style="min-width: 36px">
            <q-icon :name="nav.icon" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size: 0.84rem; font-weight: 500">
              {{ nav.label }}
            </q-item-label>
            <q-item-label
              v-if="nav.subtitle"
              caption
              style="font-size: 0.65rem; color: var(--ax-text-dim)"
            >
              {{ nav.subtitle }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Drawer footer -->
      <div class="absolute-bottom q-pa-sm">
        <q-separator style="opacity: 0.3" class="q-mb-sm" />
        <div
          class="text-center font-mono"
          style="font-size: 0.62rem; color: var(--ax-text-dim); letter-spacing: 0.04em"
        >
          axis-studio · v1.0.0
        </div>
      </div>
    </q-drawer>

    <!-- ═══════ PAGE CONTENT ═════════════════════════════════════════════ -->
    <q-page-container style="background: var(--ax-page-bg)">
      <router-view v-slot="{ Component, route: r }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="r.path" />
        </transition>
      </router-view>
    </q-page-container>

    <!-- ═══════ CONNECTION DIALOG — Glass card ════════════════════════════ -->
    <q-dialog v-model="showConn">
      <q-card
        class="ax-dialog-card"
        style="min-width: 400px; max-width: 96vw"
      >
        <!-- Gradient accent bar -->
        <div style="height: 3px; background: var(--ax-gradient-1)" />

        <q-card-section class="row items-center q-pb-none">
          <q-icon name="dns" size="20px" style="color: var(--ax-primary)" class="q-mr-sm" />
          <span style="font-size: 1rem; font-weight: 600">Node Connection</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-sm">
          <q-input
            v-model="tempUrl"
            label="AXIS Node URL"
            outlined
            dense
            placeholder="http://localhost:4747"
            class="q-mb-sm"
            @keyup.enter="applyConn"
          >
            <template #prepend>
              <q-icon name="api" />
            </template>
          </q-input>

          <div class="row items-center" style="gap: 6px">
            <span
              class="ax-dot"
              :class="{ 'ax-dot--pulse': conn.connected }"
              :style="{
                background: conn.connected ? 'var(--ax-positive)' : conn.lastError ? 'var(--ax-negative)' : 'var(--ax-text-dim)',
                color: conn.connected ? 'var(--ax-positive)' : conn.lastError ? 'var(--ax-negative)' : 'var(--ax-text-dim)'
              }"
            />
            <span style="font-size: 0.78rem; color: var(--ax-text-muted)">
              {{ conn.statusLabel }}
            </span>
            <q-spinner v-if="conn.pinging" size="14px" color="primary" />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md q-pt-none">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            icon="wifi_tethering"
            label="Test"
            :loading="conn.pinging"
            @click="conn.ping()"
            style="color: var(--ax-info)"
          />
          <q-btn
            unelevated
            label="Save"
            icon="save"
            class="ax-btn-primary"
            @click="applyConn"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useConnectionStore } from 'stores/connection';

const $q    = useQuasar();
const route = useRoute();
const conn  = useConnectionStore();

const drawer   = ref(window.innerWidth > 700);
const showConn = ref(false);
const tempUrl  = ref(conn.nodeUrl);

const navItems = [
  { label: 'Intent Sender', subtitle: 'Send & test', icon: 'send',      to: '/sender'   },
  { label: 'Registry',      subtitle: 'Browse intents', icon: 'menu_book', to: '/registry' },
  { label: 'Auth Manager',  subtitle: 'Keys & identity', icon: 'vpn_key',   to: '/auth'     },
  { label: 'History',       subtitle: 'Past requests', icon: 'history',   to: '/history'  },
];

const currentTitle = computed(() => String(route.meta?.title ?? ''));

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

<style scoped>
.ax-logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--ax-primary-soft);
  color: var(--ax-primary);
}

.ax-brand-text {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: var(--ax-gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ax-dialog-card {
  background: var(--ax-surface) !important;
  backdrop-filter: var(--ax-blur);
  border: 1px solid var(--ax-glass-border);
  border-radius: var(--ax-radius-lg) !important;
  box-shadow: var(--ax-shadow-lg);
}
</style>
