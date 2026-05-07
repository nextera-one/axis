import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface KeyEntry {
  id: string;
  label: string;
  privateKeyHex: string;
  publicKeyHex: string;
  createdAt: number;
}

export interface AuthenticatedUser {
  id: string;
  username?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  is_new_user?: boolean;
}

const AXIS_TEST_PRIVATE_KEY_HEX =
  '5ff6cfe25032c3f69cd737157afaa19982bfdb0e2995ee6ecb3711e8814b69d7';
const AXIS_TEST_PUBLIC_KEY_HEX =
  '82831fc53a4d6ece619023615022caba19ac4dd4ef3c1f1b34a1ca097e6151d9';
const AXIS_TEST_ACTOR_ID =
  import.meta.env.VITE_AXIS_ACTOR_ID ||
  'd612fe8d-5938-482c-8139-6f7c67b6e1af';

function defaultKeys(): KeyEntry[] {
  return [
    {
      id: 'axis-test-key',
      label: 'AXIS_TEST_KEY',
      privateKeyHex: AXIS_TEST_PRIVATE_KEY_HEX,
      publicKeyHex: AXIS_TEST_PUBLIC_KEY_HEX,
      createdAt: 0,
    },
  ];
}

function loadKeys(): KeyEntry[] {
  try {
    const raw = localStorage.getItem('axis_keys');
    return raw ? JSON.parse(raw) : defaultKeys();
  } catch {
    return defaultKeys();
  }
}

function loadAuthenticatedUser(): AuthenticatedUser | null {
  try {
    const raw = localStorage.getItem('axis_authenticated_user');
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const keys = ref<KeyEntry[]>(loadKeys());
  const activeKeyId = ref<string | null>(
    localStorage.getItem('axis_active_key') || keys.value[0]?.id || null,
  );
  const actorId = ref(
    localStorage.getItem('axis_actor_id') || AXIS_TEST_ACTOR_ID,
  );
  const capsuleId = ref(localStorage.getItem('axis_capsule_id') || '');
  const bearerToken = ref(
    localStorage.getItem('axis_bearer_token') || 'devjwt1010',
  );
  const secureIntentAliasMode = ref(
    localStorage.getItem('axis_secure_intent_alias_mode') === '1',
  );
  /** base64url-encoded 32-byte AES-256-GCM secret issued by the server on capsule creation */
  const intentSecret = ref(localStorage.getItem('axis_intent_secret') || '');
  const authenticatedUser = ref<AuthenticatedUser | null>(
    loadAuthenticatedUser(),
  );

  function persist() {
    localStorage.setItem('axis_keys', JSON.stringify(keys.value));
  }

  function addKey(entry: KeyEntry) {
    keys.value.push(entry);
    if (!activeKeyId.value) {
      activeKeyId.value = entry.id;
      localStorage.setItem('axis_active_key', entry.id);
    }
    persist();
  }

  function removeKey(id: string) {
    keys.value = keys.value.filter((k) => k.id !== id);
    if (activeKeyId.value === id) {
      activeKeyId.value = keys.value[0]?.id || null;
      if (activeKeyId.value) {
        localStorage.setItem('axis_active_key', activeKeyId.value);
      } else {
        localStorage.removeItem('axis_active_key');
      }
    }
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

  function setBearerToken(v: string) {
    bearerToken.value = v;
    if (v) {
      localStorage.setItem('axis_bearer_token', v);
    } else {
      localStorage.removeItem('axis_bearer_token');
    }
  }

  function setIntentSecret(v: string) {
    intentSecret.value = v;
    if (v) {
      localStorage.setItem('axis_intent_secret', v);
    } else {
      localStorage.removeItem('axis_intent_secret');
    }
  }

  function setSecureIntentAliasMode(v: boolean) {
    secureIntentAliasMode.value = Boolean(v);
    localStorage.setItem(
      'axis_secure_intent_alias_mode',
      secureIntentAliasMode.value ? '1' : '0',
    );
  }

  function setAuthenticatedUser(user: AuthenticatedUser | null) {
    authenticatedUser.value = user;
    if (user) {
      localStorage.setItem('axis_authenticated_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('axis_authenticated_user');
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
    bearerToken,
    secureIntentAliasMode,
    intentSecret,
    authenticatedUser,
    addKey,
    removeKey,
    setActive,
    setActorId,
    setCapsuleId,
    setBearerToken,
    setSecureIntentAliasMode,
    setIntentSecret,
    setAuthenticatedUser,
    getActiveKey,
  };
});
