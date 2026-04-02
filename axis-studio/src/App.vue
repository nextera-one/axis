<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

onMounted(() => {
  const pref = localStorage.getItem('axis_dark_mode');
  if (pref !== null) {
    $q.dark.set(pref !== 'false');
  }
});
</script>
