<template>
  <q-layout view="lHh lpR lFf" class="studio-layout">
    <q-header class="studio-header">
      <q-toolbar class="studio-toolbar q-gutter-sm">
        <q-btn
          flat
          round
          dense
          icon="menu"
          class="lt-md"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <q-input
          v-model="searchQuery"
          dense
          borderless
          placeholder="Query protocol..."
          class="studio-search"
          @keyup.enter="searchProtocol"
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <div class="studio-header-badge">Beta</div>

        <q-space />

        <div class="studio-top-links gt-sm">
          <button @click="router.push('/registry')">Intents</button>
          <button @click="router.push('/auth')">Actors</button>
          <button @click="router.push('/history')">Proofs</button>
        </div>

        <q-btn flat dense round icon="hub" @click="router.push('/registry')" />
        <q-btn flat dense round icon="security" @click="router.push('/auth')" />
        <q-btn
          flat
          dense
          round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleDark"
        />
        <q-btn
          unelevated
          no-caps
          class="studio-connect-btn"
          :label="conn.connected ? 'Connected' : 'Connect'"
          @click="openConnDialog"
        />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      behavior="desktop"
      :breakpoint="0"
      :width="240"
      class="studio-drawer"
    >
      <div class="studio-brand">
        <div class="studio-brand__title">AXIS STUDIO</div>
        <div class="studio-brand__version">v1.0.4-beta</div>
      </div>

      <q-list class="studio-nav">
        <q-item
          v-for="nav in navItems"
          :key="nav.to"
          clickable
          :active="route.path.startsWith(nav.to)"
          active-class="studio-nav-item--active"
          @click="router.push(nav.to)"
          class="studio-nav-item"
        >
          <q-item-section avatar>
            <q-icon :name="nav.icon" />
          </q-item-section>
          <q-item-section>{{ nav.label }}</q-item-section>
        </q-item>
      </q-list>

      <div class="studio-drawer-footer">
        <button class="studio-drawer-action" @click="openConnDialog">
          <q-icon name="settings" size="18px" />
          <span>Settings</span>
        </button>
        <div class="studio-drawer-action studio-drawer-action--status">
          <q-icon
            name="sensors"
            size="18px"
            :color="conn.connected ? 'positive' : 'negative'"
          />
          <span>{{ conn.connected ? "Connected" : "Disconnected" }}</span>
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <q-page class="studio-page">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </q-page>
    </q-page-container>

    <q-footer class="studio-footer">
      <div class="studio-status-item">
        <q-icon name="speed" size="14px" />
        <span
          >Latency:
          {{ conn.latencyMs != null ? conn.latencyMs + "ms" : "—" }}</span
        >
      </div>
      <div class="studio-status-item studio-status-item--primary">
        <q-icon name="straighten" size="14px" />
        <span>Frame: {{ conn.connected ? "Secured" : "N/A" }}</span>
      </div>
      <div class="studio-status-item">
        <q-icon name="verified_user" size="14px" />
        <span>Valid: {{ conn.connected ? "100%" : "—" }}</span>
      </div>
      <div class="studio-status-item">
        <q-icon name="terminal" size="14px" />
        <span>Result: {{ conn.connected ? "Success" : "N/A" }}</span>
      </div>
      <div class="studio-live-indicator">
        <span
          class="studio-live-dot"
          :class="{ 'studio-live-dot--active': conn.connected }"
        />
        {{ conn.connected ? "LIVE_PROTOCOL_FEED" : "DISCONNECTED" }}
      </div>
    </q-footer>

    <q-dialog v-model="showConn">
      <q-card class="studio-conn-card">
        <div class="studio-conn-card__head">
          <AxisLogo :size="24" />
          <span>Node Connection</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup size="sm" />
        </div>

        <div class="studio-conn-card__body">
          <q-input
            v-model="tempUrl"
            dense
            outlined
            label="AXIS Node URL"
            placeholder="http://localhost:4747/axis"
            @keyup.enter="applyConn"
          >
            <template #prepend>
              <q-icon name="api" />
            </template>
          </q-input>

          <div class="studio-conn-status">
            <q-icon
              :name="
                conn.connected
                  ? 'check_circle'
                  : conn.lastError
                    ? 'cancel'
                    : 'help_outline'
              "
              :color="
                conn.connected
                  ? 'positive'
                  : conn.lastError
                    ? 'negative'
                    : 'grey'
              "
              size="16px"
            />
            <span>{{ conn.statusLabel }}</span>
            <q-spinner v-if="conn.pinging" size="12px" color="primary" />
          </div>
        </div>

        <div class="studio-conn-card__foot">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            flat
            no-caps
            color="info"
            label="Test"
            :loading="conn.pinging"
            @click="testConn"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            @click="applyConn"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useConnectionStore } from "stores/connection";
import AxisLogo from "src/components/AxisLogo.vue";

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const conn = useConnectionStore();

const showConn = ref(false);
const leftDrawerOpen = ref(true);
const tempUrl = ref(conn.nodeUrl);
const searchQuery = ref("");

const navItems = [
  { label: "Sender", icon: "send", to: "/sender" },
  { label: "Registry", icon: "database", to: "/registry" },
  { label: "Auth", icon: "key", to: "/auth" },
  { label: "History", icon: "history", to: "/history" },
];

function openConnDialog() {
  tempUrl.value = conn.nodeUrl;
  showConn.value = true;
}

function searchProtocol() {
  const q = searchQuery.value.trim();
  if (!q) return;
  router.push({ path: "/registry", query: { q } });
  searchQuery.value = "";
}

function toggleDark() {
  $q.dark.toggle();
  localStorage.setItem("axis_dark_mode", String($q.dark.isActive));
}

async function testConn() {
  const candidate = tempUrl.value.trim();
  if (!candidate) return;
  await conn.ping(candidate);
}

async function applyConn() {
  const candidate = tempUrl.value.trim();
  if (!candidate) return;
  conn.setNodeUrl(candidate);
  await conn.ping();
  showConn.value = false;
}

void conn.ping();
</script>
