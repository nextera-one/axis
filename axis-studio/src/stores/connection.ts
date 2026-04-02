import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useConnectionStore = defineStore('connection', () => {
  const nodeUrl = ref(
    localStorage.getItem('axis_node_url') || 'http://localhost:3000',
  );
  const connected = ref(false);
  const latencyMs = ref<number | null>(null);
  const lastError = ref<string | null>(null);

  function setNodeUrl(url: string) {
    nodeUrl.value = url.replace(/\/+$/, '');
    localStorage.setItem('axis_node_url', nodeUrl.value);
    connected.value = false;
    latencyMs.value = null;
    lastError.value = null;
  }

  async function ping() {
    const start = performance.now();
    try {
      const res = await fetch(nodeUrl.value + '/health', {
        signal: AbortSignal.timeout(5000),
      });
      latencyMs.value = Math.round(performance.now() - start);
      connected.value = res.ok;
      lastError.value = res.ok ? null : `HTTP ${res.status}`;
    } catch (e: any) {
      latencyMs.value = null;
      connected.value = false;
      lastError.value = e.message || 'Connection failed';
    }
  }

  const statusLabel = computed(() => {
    if (connected.value) return `Connected (${latencyMs.value}ms)`;
    if (lastError.value) return lastError.value;
    return 'Disconnected';
  });

  return {
    nodeUrl,
    connected,
    latencyMs,
    lastError,
    statusLabel,
    setNodeUrl,
    ping,
  };
});
