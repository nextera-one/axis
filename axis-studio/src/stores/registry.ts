import { defineStore } from "pinia";
import { ref } from "vue";
import {
  fetchCatalog,
  type IntentCatalogEntry,
} from "src/services/axis-client";

export const useRegistryStore = defineStore("registry", () => {
  const intents = ref<IntentCatalogEntry[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const lastError = ref<string | null>(null);

  async function load(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    lastError.value = null;
    try {
      intents.value = await fetchCatalog();
      loaded.value = true;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  function invalidate() {
    loaded.value = false;
  }

  function reset() {
    intents.value = [];
    loaded.value = false;
    lastError.value = null;
  }

  return { intents, loading, loaded, lastError, load, invalidate, reset };
});
