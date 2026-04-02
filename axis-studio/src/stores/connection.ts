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

  async function ping() {
    if (pinging.value) return;
    pinging.value = true;
    const start = performance.now();
    try {
      const frame = {
        v: 1,
        pid: crypto.randomUUID(),
        nonce: btoa(
          String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))),
        ),
        ts: Date.now(),
        actorId: 'studio:anonymous',
        aud: 'axis-core',
        opcode: 'system.ping',
        body: {},
      };
      const res = await fetch(nodeUrl.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frame),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json().catch(() => ({}));
      latencyMs.value = Math.round(performance.now() - start);
      connected.value = res.ok && data?.ok === true;
      lastError.value = connected.value ? null : `HTTP ${res.status}`;
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
