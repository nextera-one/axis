<template>
  <q-layout view="lHh LpR lFf">

    <!-- ═══════ TOP BAR ════════════════════════════════════════ -->
    <q-header elevated :class="headerBg">
      <q-toolbar>
        <q-btn
          flat dense round
          aria-label="Toggle menu"
          icon="menu"
          @click="drawer = !drawer"
          class="q-mr-sm"
        />

        <!-- Brand mark -->
        <div class="brand-link row items-center no-wrap q-mr-md">
          <q-icon name="hexagon" color="primary" size="20px" />
          <span
            class="text-weight-bold text-primary q-ml-xs"
            style="font-size: 1.05rem; letter-spacing: 0.03em"
          >AXIS</span>
          <span
            class="q-ml-xs text-weight-regular"
            :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-7'"
            style="font-size: 0.88rem"
          >Studio</span>
        </div>

        <!-- Page title (md+) -->
        <span
          class="gt-sm text-caption text-weight-medium"
          :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-6'"
        >
          {{ currentTitle }}
        </span>

        <q-space />

        <!-- Connection chip -->
        <q-chip
          dense clickable
          :color="conn.connected ? 'positive' : conn.lastError ? 'negative' : 'grey-7'"
          text-color="white"
          size="sm"
          class="q-mr-xs"
          @click="showConn = true"
        >
          <q-icon
            :name="conn.connected ? 'link' : 'link_off'"
            size="14px"
            class="q-mr-xs"
          />
          <span class="gt-xs font-mono" style="font-size: 0.75rem">
            {{ conn.connected ? conn.latencyMs + ' ms' : 'Offline' }}
          </span>
        </q-chip>

        <!-- Dark / light toggle -->
        <q-btn
          flat dense round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :title="$q.dark.isActive ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDark"
        />
      </q-toolbar>
    </q-header>

    <!-- ═══════ LEFT DRAWER ════════════════════════════════════ -->
    <q-drawer
      v-model="drawer"
      :width="228"
      :breakpoint="700"
      bordered
      :class="drawerBg"
    >
      <div class="q-pa-md q-pb-xs">
        <div
          class="text-overline"
          style="font-size: 0.62rem; letter-spacing: 0.12em; font-weight: 700"
          :class="$q.dark.isActive ? 'text-grey-7' : 'text-grey-6'"
        >
          TOOLS
        </div>
      </div>

      <q-list dense class="q-px-sm">
        <q-item
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          clickable
          v-ripple
          active-class="nav-active"
          class="nav-item q-mb-xs rounded-borders"
        >
          <q-item-section avatar style="min-width: 34px">
            <q-icon :name="nav.icon" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium" style="font-size: 0.87rem">
              {{ nav.label }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Drawer footer -->
      <div class="absolute-bottom q-pa-sm">
        <q-separator class="q-mb-sm" />
        <div
          class="text-caption text-center"
          :class="$q.dark.isActive ? 'text-grey-7' : 'text-grey-6'"
        >
          axis-studio · v1.0.0
        </div>
      </div>
    </q-drawer>

    <!-- ═══════ PAGE CONTENT ═══════════════════════════════════ -->
    <q-page-container :class="$q.dark.isActive ? '' : 'bg-grey-2'">
      <router-view v-slot="{ Component, route }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </q-page-container>

    <!-- ═══════ CONNECTION DIALOG ══════════════════════════════ -->
    <q-dialog v-model="showConn">
      <q-card style="min-width: 380px; max-width: 96vw">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="dns" color="primary" size="20px" class="q-mr-sm" />
          <span class="text-h6">Node Connection</span>
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

          <div class="row items-center q-gutter-xs">
            <q-icon
              :name="conn.connected ? 'check_circle' : conn.lastError ? 'cancel' : 'help_outline'"
              :color="conn.connected ? 'positive' : conn.lastError ? 'negative' : 'grey-5'"
              size="14px"
            />
            <span class="text-caption" :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-6'">
              {{ conn.statusLabel }}
            </span>
            <q-spinner v-if="conn.pinging" size="14px" color="primary" />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md q-pt-none">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            color="info"
            icon="wifi_tethering"
            label="Test"
            :loading="conn.pinging"
            @click="conn.ping()"
          />
          <q-btn
            unelevated
            color="primary"
            icon="save"
            label="Save"
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

const $q   = useQuasar();
const route = useRoute();
const conn  = useConnectionStore();

const drawer   = ref(window.innerWidth > 700);
const showConn = ref(false);
const tempUrl  = ref(conn.nodeUrl);

const navItems = [
  { label: 'Intent Sender',  icon: 'send',      to: '/sender'   },
  { label: 'Registry',       icon: 'menu_book', to: '/registry' },
  { label: 'Auth Manager',   icon: 'vpn_key',   to: '/auth'     },
  { label: 'History',        icon: 'history',   to: '/history'  },
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

