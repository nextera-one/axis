import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useConnectionStore = defineStore('connection', () => {
  const nodeUrl = ref(
    localStorage.getItem('axis_node_url') || 'http://localhost:4747/axis',
  );
  const connected = ref(false);
  const latencyMs = ref<number | null>(null);
  const lastError = ref<string | null>(null);
  const pinging = ref(false);

  function setNodeUrl(url: string) {
    nodeUrl.value = url.replace(/\/+$/, '');
    localStorage.setItem('axis_node_url', nodeUrl.value);
    connected.value = false;
    latencyMs.value = null;
    lastError.value = null;
  }

  async function ping(urlOverride?: string) {
    if (pinging.value) return;
    pinging.value = true;
    try {
      const { sendIntent } = await import('src/services/axis-client');
      const result = await sendIntent(
        'system.ping',
        {},
        urlOverride,
        { recordHistory: false },
      );
      
      latencyMs.value = result.durationMs;
      const status = String(result.response?.status || '').toUpperCase();
      connected.value =
        result.ok &&
        (
          result.response?.ok === true ||
          status === 'OK' ||
          status === 'UP' ||
          result.status === 200
        );
      lastError.value = connected.value ? null : `Status: ${result.status}`;
    } catch (e: any) {
      latencyMs.value = null;
      connected.value = false;
      lastError.value = e.message || 'Connection failed';
    } finally {
      pinging.value = false;
    }
  }

  const statusLabel = computed(() => {
    if (pinging.value) return 'Checking…';
    if (connected.value) return `Connected (${latencyMs.value}ms)`;
    if (lastError.value) return lastError.value;
    return 'Disconnected';
  });

  return {
    nodeUrl,
    connected,
    latencyMs,
    lastError,
    pinging,
    statusLabel,
    setNodeUrl,
    ping,
  };
});
