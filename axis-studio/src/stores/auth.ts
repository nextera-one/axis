import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface KeyEntry {
  id: string;
  label: string;
  privateKeyHex: string;
  publicKeyHex: string;
  createdAt: number;
}

function loadKeys(): KeyEntry[] {
  try {
    const raw = localStorage.getItem('axis_keys');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useAuthStore = defineStore('auth', () => {
  const keys = ref<KeyEntry[]>(loadKeys());
  const activeKeyId = ref<string | null>(
    localStorage.getItem('axis_active_key'),
  );
  const actorId = ref(localStorage.getItem('axis_actor_id') || '');
  const capsuleId = ref(localStorage.getItem('axis_capsule_id') || '');
  /** base64url-encoded 32-byte AES-256-GCM secret issued by the server on capsule creation */
  const intentSecret = ref(localStorage.getItem('axis_intent_secret') || '');

  function persist() {
    localStorage.setItem('axis_keys', JSON.stringify(keys.value));
  }

  function addKey(entry: KeyEntry) {
    keys.value.push(entry);
    if (!activeKeyId.value) activeKeyId.value = entry.id;
    persist();
  }

  function removeKey(id: string) {
    keys.value = keys.value.filter((k) => k.id !== id);
    if (activeKeyId.value === id) activeKeyId.value = keys.value[0]?.id || null;
    persist();
  }

  function setActive(id: string) {
    activeKeyId.value = id;
    localStorage.setItem('axis_active_key', id);
  }

  function setActorId(v: string) {
    actorId.value = v;
    localStorage.setItem('axis_actor_id', v);
  }

  function setCapsuleId(v: string) {
    capsuleId.value = v;
    localStorage.setItem('axis_capsule_id', v);
  }

  function setIntentSecret(v: string) {
    intentSecret.value = v;
    if (v) {
      localStorage.setItem('axis_intent_secret', v);
    } else {
      localStorage.removeItem('axis_intent_secret');
    }
  }

  function getActiveKey(): KeyEntry | null {
    return keys.value.find((k) => k.id === activeKeyId.value) || null;
  }

  return {
    keys,
    activeKeyId,
    actorId,
    capsuleId,
    intentSecret,
    addKey,
    removeKey,
    setActive,
    setActorId,
    setCapsuleId,
    setIntentSecret,
    getActiveKey,
  };
});
