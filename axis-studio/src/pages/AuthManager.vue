<template>
  <div class="auth-page">
    <section class="auth-head">
      <div>
        <div class="auth-eyebrow">Protocol Signing Engine</div>
        <h1>Identity Vault</h1>
      </div>
      <div class="auth-stats">
        <div v-for="stat in stats" :key="stat.label" class="auth-stat">
          <small>{{ stat.label }}</small>
          <span>{{ stat.value }}</span>
        </div>
      </div>
    </section>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-5">
        <q-card flat bordered class="auth-card q-mb-md">
          <q-card-section>
            <div class="auth-card-title">
              <q-icon name="badge" size="16px" />
              <span>Actor Context</span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section class="q-gutter-md">
            <q-input
              :model-value="auth.actorId"
              dense
              outlined
              label="Actor ID"
              placeholder="actor:anonymous"
              @update:model-value="(v) => auth.setActorId(String(v ?? ''))"
            />
            <q-input
              :model-value="auth.capsuleId"
              dense
              outlined
              label="Capsule ID"
              placeholder="optional UUID"
              @update:model-value="(v) => auth.setCapsuleId(String(v ?? ''))"
            />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="auth-card">
          <q-card-section class="row items-center justify-between">
            <div class="auth-card-title">
              <q-icon name="key" size="16px" />
              <span>Ed25519 Keyrings</span>
            </div>
            <q-btn
              flat
              no-caps
              color="primary"
              :loading="generating"
              label="Generate New"
              @click="generateKey"
            />
          </q-card-section>
          <q-separator />

          <q-list separator>
            <q-item
              v-for="k in auth.keys"
              :key="k.id"
              clickable
              :active="auth.activeKeyId === k.id"
              active-class="auth-key-item--active"
              class="auth-key-item"
              @click="auth.setActive(k.id)"
            >
              <q-item-section>
                <q-item-label>{{ k.label }}</q-item-label>
                <q-item-label caption class="ellipsis">{{ k.publicKeyHex }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="negative"
                  @click.stop="auth.removeKey(k.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>

          <div v-if="!auth.keys.length" class="auth-empty">
            <q-icon name="lock_open" size="36px" />
            <span>Vault is empty</span>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-7">
        <q-card v-if="activeKey" flat bordered class="auth-card auth-card--active">
          <q-card-section class="row items-center justify-between">
            <div>
              <div class="auth-eyebrow">Operational Key</div>
              <h2>{{ activeKey.label }}</h2>
            </div>
            <q-btn flat no-caps color="primary" label="Copy Pub Key" @click="copyPub" />
          </q-card-section>
          <q-separator />

          <q-card-section class="q-gutter-md">
            <div>
              <div class="auth-label">Public Key</div>
              <pre class="auth-key-box">{{ activeKey.publicKeyHex }}</pre>
            </div>

            <div>
              <div class="row items-center justify-between q-mb-xs">
                <div class="auth-label">Private Key</div>
                <q-btn
                  flat
                  dense
                  no-caps
                  size="sm"
                  :label="showPrivate ? 'Conceal' : 'Reveal'"
                  @click="showPrivate = !showPrivate"
                />
              </div>
              <pre class="auth-key-box">
{{ showPrivate ? activeKey.privateKeyHex : '•'.repeat(64) }}
              </pre>
            </div>

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-card flat bordered class="auth-mini-card">
                  <q-card-section>
                    <small>Created</small>
                    <div>{{ new Date(activeKey.createdAt).toLocaleString() }}</div>
                  </q-card-section>
                </q-card>
              </div>
              <div class="col-12 col-sm-6">
                <q-card flat bordered class="auth-mini-card">
                  <q-card-section>
                    <small>Algorithm</small>
                    <div>ED25519_CORE_V1</div>
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <div v-else class="auth-empty auth-empty--large">
          <q-icon name="key_off" size="54px" />
          <span>No active key loaded</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAuthStore } from 'stores/auth';
import * as ed from '@noble/ed25519';

const $q = useQuasar();
const auth = useAuthStore();

const generating = ref(false);
const showPrivate = ref(false);

const activeKey = computed(() => auth.getActiveKey());

const stats = computed(() => [
  { label: 'KEYS LOADED', value: auth.keys.length },
  { label: 'ACTIVE KEY', value: activeKey.value ? activeKey.value.label : 'NULL' },
  { label: 'ACTOR ID', value: auth.actorId ? 'SET' : 'LOCAL_ANON' },
]);

async function generateKey() {
  generating.value = true;
  try {
    const secretKey = ed.utils.randomSecretKey();
    const publicKey = await ed.getPublicKeyAsync(secretKey);

    const toHex = (buf: Uint8Array) =>
      Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    auth.addKey({
      id: crypto.randomUUID(),
      label: 'SEQUENCE_KEY_' + (auth.keys.length + 1),
      privateKeyHex: toHex(secretKey),
      publicKeyHex: toHex(publicKey),
      createdAt: Date.now(),
    });

    $q.notify({
      message: 'AUTHENTICATION_KEY_ROTATED_SUCCESS',
      icon: 'verified',
      color: 'positive',
      timeout: 2000,
    });
  } catch {
    $q.notify({
      message: 'KEY_GENERATION_FAILED',
      icon: 'error',
      color: 'negative',
      timeout: 2500,
    });
  } finally {
    generating.value = false;
  }
}

async function copyPub() {
  if (!activeKey.value) return;
  try {
    await navigator.clipboard.writeText(activeKey.value.publicKeyHex);
    $q.notify({
      message: 'PUBLIC_KEY_COPIED_TO_CLIPBOARD',
      icon: 'content_copy',
      color: 'positive',
      timeout: 1200,
    });
  } catch {
    $q.notify({ message: 'CLIPBOARD_ACCESS_DENIED', color: 'negative', timeout: 1200 });
  }
}
</script>
