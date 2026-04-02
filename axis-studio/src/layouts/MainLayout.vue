<template>
  <q-layout view="lHh LpR lFf">
    <!-- ═══════ TOP BAR ════════════════════════════════════════ -->
    <q-header :class="headerBg" style="height: 44px">
      <q-toolbar style="min-height: 44px; padding: 0 10px">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Toggle menu"
          @click="drawer = !drawer"
          style="color: var(--ax-text-muted)"
          class="q-mr-sm"
        />

        <!-- Brand -->
        <div
          class="row items-center no-wrap q-mr-lg"
          style="gap: 8px; text-decoration: none"
        >
          <img
            :src="
              $q.dark.isActive ? 'images/logo-mini.svg' : 'images/logo-mini.svg'
            "
            width="22"
            height="17"
            alt="NestFlow"
            style="display: block; flex-shrink: 0"
          />
          <span
            class="ax-brand-gradient"
            style="
              font-weight: 700;
              font-size: 0.92rem;
              letter-spacing: 0.06em;
              font-family: 'Inter', sans-serif;
            "
            >AXIS</span
          >
          <span
            style="
              font-size: 0.76rem;
              color: var(--ax-text-dim);
              font-weight: 400;
            "
            >Studio</span
          >
        </div>

        <!-- Current page breadcrumb -->
        <span
          class="gt-sm"
          style="font-size: 0.76rem; color: var(--ax-text-dim)"
        >
          {{ currentTitle }}
        </span>

        <q-space />

        <!-- Connection status pill -->
        <div
          class="ax-conn-status"
          :class="
            conn.connected
              ? 'ax-conn-status--connected'
              : conn.lastError
                ? 'ax-conn-status--error'
                : ''
          "
          @click="showConn = true"
          :title="`Node: ${conn.nodeUrl}`"
        >
          <span class="ax-conn-dot" />
          <span>{{ conn.connected ? conn.latencyMs + ' ms' : 'Offline' }}</span>
          <q-spinner v-if="conn.pinging" size="10px" color="primary" />
        </div>

        <!-- Dark / light toggle -->
        <q-btn
          flat
          dense
          round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :title="$q.dark.isActive ? 'Light mode' : 'Dark mode'"
          @click="toggleDark"
          style="color: var(--ax-text-muted); margin-left: 6px"
        />
      </q-toolbar>
    </q-header>

    <!-- ═══════ LEFT DRAWER ════════════════════════════════════ -->
    <q-drawer v-model="drawer" :width="216" :breakpoint="700" :class="drawerBg">
      <!-- Section label -->
      <div style="padding: 14px 16px 4px">
        <span
          style="
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--ax-text-dim);
          "
          >Navigator</span
        >
      </div>

      <!-- Nav items -->
      <q-list dense style="padding: 0 6px">
        <q-item
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          clickable
          v-ripple
          active-class="nav-active"
          class="nav-item"
        >
          <q-item-section avatar style="min-width: 28px">
            <q-icon :name="nav.icon" size="15px" />
          </q-item-section>
          <q-item-section>
            <q-item-label
              style="
                font-size: 0.82rem;
                font-weight: 500;
                color: var(--ax-text);
              "
            >
              {{ nav.label }}
            </q-item-label>
            <q-item-label
              caption
              style="
                font-size: 0.68rem;
                color: var(--ax-text-dim);
                margin-top: 1px;
              "
            >
              {{ nav.sub }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Divider + server info -->
      <div
        style="
          padding: 8px 14px;
          margin-top: 8px;
          border-top: 1px solid var(--ax-border);
        "
      >
        <div
          style="
            font-size: 0.68rem;
            color: var(--ax-text-dim);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 600;
          "
        >
          Node
        </div>
        <div
          class="font-mono"
          style="
            font-size: 0.68rem;
            color: var(--ax-text-muted);
            word-break: break-all;
            line-height: 1.4;
          "
        >
          {{ conn.nodeUrl }}
        </div>
      </div>

      <!-- Footer -->
      <div
        class="absolute-bottom"
        style="padding: 6px 12px; border-top: 1px solid var(--ax-border-subtle)"
      >
        <!-- Nestflow branding footer -->
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
          "
        >
          <img
            src="images/logo-horz.svg"
            width="88"
            height="13"
            alt="NestFlow"
            style="opacity: 0.25; display: block"
          />
          <div style="font-size: 0.62rem; color: var(--ax-text-dim)">
            axis-studio · v1.0.0
          </div>
        </div>
      </div>
    </q-drawer>

    <!-- ═══════ PAGE CONTENT ═══════════════════════════════════ -->
    <q-page-container style="background: var(--ax-bg)">
      <router-view v-slot="{ Component, route }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </q-page-container>

    <!-- ═══════ CONNECTION DIALOG ══════════════════════════════ -->
    <q-dialog v-model="showConn">
      <q-card
        style="
          min-width: 360px;
          max-width: 96vw;
          background: var(--ax-surface);
          border: 1px solid var(--ax-border);
          border-radius: 8px;
        "
      >
        <!-- Header -->
        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 16px 10px;
            border-bottom: 1px solid var(--ax-border);
          "
        >
          <q-icon name="dns" style="color: var(--ax-primary)" size="17px" />
          <span
            style="font-size: 0.9rem; font-weight: 600; color: var(--ax-text)"
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
            style="color: var(--ax-text-muted)"
          />
        </div>

        <!-- Body -->
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

          <!-- Status row -->
          <div
            style="
              display: flex;
              align-items: center;
              gap: 6px;
              margin-top: 10px;
            "
          >
            <q-icon
              :name="
                conn.connected
                  ? 'check_circle'
                  : conn.lastError
                    ? 'cancel'
                    : 'help_outline'
              "
              :style="{
                color: conn.connected
                  ? 'var(--ax-ok)'
                  : conn.lastError
                    ? 'var(--ax-error)'
                    : 'var(--ax-text-dim)',
              }"
              size="14px"
            />
            <span style="font-size: 0.76rem; color: var(--ax-text-muted)">{{
              conn.statusLabel
            }}</span>
            <q-spinner v-if="conn.pinging" size="12px" color="primary" />
          </div>
        </div>

        <!-- Actions -->
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
            style="color: var(--ax-text-muted)"
          />
          <q-btn
            flat
            color="info"
            icon="wifi_tethering"
            label="Test"
            :loading="conn.pinging"
            @click="conn.ping()"
            size="sm"
          />
          <q-btn
            unelevated
            color="primary"
            icon="save"
            label="Save"
            @click="applyConn"
            size="sm"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useConnectionStore } from 'stores/connection';

const $q = useQuasar();
const route = useRoute();
const conn = useConnectionStore();

const drawer = ref(window.innerWidth > 700);
const showConn = ref(false);
const tempUrl = ref(conn.nodeUrl);

const navItems = [
  { label: 'Sender', sub: 'Send intents', icon: 'send', to: '/sender' },
  {
    label: 'Registry',
    sub: 'Browse catalog',
    icon: 'menu_book',
    to: '/registry',
  },
  { label: 'Auth', sub: 'Keys & identity', icon: 'vpn_key', to: '/auth' },
  { label: 'History', sub: 'Past requests', icon: 'history', to: '/history' },
];

const currentTitle = computed(() => String(route.meta?.title ?? ''));

function toggleDark() {
  $q.dark.toggle();
  localStorage.setItem('axis_dark_mode', String($q.dark.isActive));
}

const headerBg = computed(() =>
  $q.dark.isActive ? 'ax-header--dark' : 'ax-header--light',
);
const drawerBg = computed(() =>
  $q.dark.isActive ? 'ax-drawer--dark' : 'ax-drawer--light',
);

function applyConn() {
  conn.setNodeUrl(tempUrl.value);
  conn.ping();
  showConn.value = false;
}

conn.ping();
</script>
