<template>
  <q-layout view="lLp Lpr lFf">
    <!-- Header -->
    <q-header class="bg-dark">
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="drawer = !drawer" />
        <q-toolbar-title class="text-weight-bold">
          <span class="text-primary">AXIS</span> Studio
        </q-toolbar-title>

        <!-- Connection indicator -->
        <q-chip
          :color="conn.connected ? 'positive' : 'negative'"
          text-color="white"
          dense
          size="sm"
          clickable
          @click="showConnection = true"
        >
          <q-icon
            :name="conn.connected ? 'cloud_done' : 'cloud_off'"
            class="q-mr-xs"
          />
          {{ conn.connected ? conn.latencyMs + 'ms' : 'Offline' }}
        </q-chip>
      </q-toolbar>
    </q-header>

    <!-- Sidebar -->
    <q-drawer v-model="drawer" :width="220" bordered class="bg-dark">
      <q-list>
        <q-item-label header class="text-grey-5 q-mt-sm"
          >Navigation</q-item-label
        >

        <q-item
          v-for="nav in navItems"
          :key="nav.to"
          :to="nav.to"
          clickable
          v-ripple
          active-class="text-primary bg-grey-10"
        >
          <q-item-section avatar>
            <q-icon :name="nav.icon" />
          </q-item-section>
          <q-item-section>{{ nav.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- Page content -->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Connection dialog -->
    <q-dialog v-model="showConnection">
      <q-card style="min-width: 380px" class="bg-dark">
        <q-card-section>
          <div class="text-h6">Node Connection</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="tempUrl"
            label="AXIS Node URL"
            dense
            outlined
            dark
            class="q-mb-md"
            @keyup.enter="applyUrl"
          />
          <div class="text-caption text-grey-5">
            Status: {{ conn.statusLabel }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Test" color="info" @click="conn.ping()" />
          <q-btn flat label="Save" color="primary" @click="applyUrl" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useConnectionStore } from 'stores/connection';

const conn = useConnectionStore();
const drawer = ref(true);
const showConnection = ref(false);
const tempUrl = ref(conn.nodeUrl);

const navItems = [
  { label: 'Intent Sender', icon: 'send', to: '/sender' },
  { label: 'Registry', icon: 'menu_book', to: '/registry' },
  { label: 'Auth Manager', icon: 'vpn_key', to: '/auth' },
  { label: 'History', icon: 'history', to: '/history' },
];

function applyUrl() {
  conn.setNodeUrl(tempUrl.value);
  conn.ping();
  showConnection.value = false;
}

onMounted(() => {
  conn.ping();
});
</script>
