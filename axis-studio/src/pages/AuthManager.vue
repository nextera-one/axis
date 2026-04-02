<template>
  <q-page class="ax-page q-pa-md">
    <div class="row q-col-gutter-md">

      <!-- ══════ IDENTITY ════════════════════════════════════════════════ -->
      <div class="col-12 col-md-6">
        <div class="ax-panel ax-panel-accent" style="position: relative">
          <div class="ax-panel-header row items-center">
            <q-icon name="badge" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title">Identity</span>
          </div>
          <div class="q-pa-md">
            <q-input
              :model-value="auth.actorId"
              label="Actor ID"
              outlined dense
              placeholder="actor:user_abc123"
              class="q-mb-sm"
              @update:model-value="(v) => auth.setActorId(String(v ?? ''))"
            />
            <q-input
              :model-value="auth.capsuleId"
              label="Capsule ID"
              outlined dense
              placeholder="(optional)"
              @update:model-value="(v) => auth.setCapsuleId(String(v ?? ''))"
            />
            <div style="font-size: 0.72rem; color: var(--ax-text-dim); margin-top: 8px">
              The Actor ID is attached to every intent frame. Leave empty to
              send as <span class="font-mono">studio:anonymous</span>.
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ SIGNING KEYS ════════════════════════════════════════════ -->
      <div class="col-12 col-md-6">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center">
            <q-icon name="key" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title q-mr-auto">Signing Keys</span>
            <q-btn
              flat dense round size="xs"
              icon="add"
              title="Generate new key pair"
              :loading="generating"
              style="color: var(--ax-primary)"
              @click="generateKey"
            />
          </div>

          <q-list dense separator>
            <q-item
              v-for="k in auth.keys"
              :key="k.id"
              :active="auth.activeKeyId === k.id"
              active-class="key-item--active"
              class="key-item"
              clickable
              v-ripple
              @click="auth.setActive(k.id)"
            >
              <q-item-section avatar style="min-width: 32px">
                <q-icon
                  :name="auth.activeKeyId === k.id ? 'radio_button_checked' : 'radio_button_unchecked'"
                  size="16px"
                  :style="{ color: auth.activeKeyId === k.id ? 'var(--ax-primary)' : 'var(--ax-text-dim)' }"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label style="font-weight: 500">{{ k.label }}</q-item-label>
                <q-item-label caption class="font-mono" style="font-size: 0.68rem; color: var(--ax-text-dim)">
                  {{ k.publicKeyHex.slice(0, 20) }}…
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat dense round
                  icon="delete"
                  size="xs"
                  style="color: var(--ax-negative)"
                  @click.stop="auth.removeKey(k.id)"
                />
              </q-item-section>
            </q-item>

            <q-item v-if="!auth.keys.length">
              <q-item-section class="ax-empty" style="padding: 24px 16px">
                <q-icon name="vpn_key" class="ax-empty-icon" style="font-size: 32px" />
                <div class="ax-empty-text">No keys yet — click + to generate</div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>

      <!-- ══════ ACTIVE KEY DETAIL ═══════════════════════════════════════ -->
      <div v-if="activeKey" class="col-12">
        <div class="ax-panel">
          <div class="ax-panel-header row items-center">
            <q-icon name="fingerprint" size="15px" style="color: var(--ax-primary)" class="q-mr-xs" />
            <span class="ax-panel-title">
              Active Key — {{ activeKey.label }}
            </span>
            <q-space />
            <q-btn
              flat dense size="xs"
              icon="content_copy"
              label="Copy public key"
              @click="copyPub"
            />
          </div>

          <div class="q-pa-md">
            <div class="row q-col-gutter-md">

              <!-- Public key -->
              <div class="col-12 col-md-6">
                <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-text-dim); margin-bottom: 6px; margin-left: 2px">
                  Public Key (hex)
                </div>
                <div class="ax-key-box font-mono" style="font-size: 0.72rem">
                  {{ activeKey.publicKeyHex }}
                </div>
              </div>

              <!-- Private key (hidden by default) -->
              <div class="col-12 col-md-6">
                <div class="row items-center" style="margin-bottom: 6px">
                  <div style="font-size: 0.72rem; font-weight: 500; color: var(--ax-text-dim); margin-left: 2px" class="q-mr-auto">
                    Private Key (hex)
                  </div>
                  <q-btn
                    flat dense round size="xs"
                    :icon="showPrivate ? 'visibility_off' : 'visibility'"
                    :style="{ color: showPrivate ? 'var(--ax-warning)' : 'var(--ax-text-dim)' }"
                    :title="showPrivate ? 'Hide' : 'Reveal'"
                    @click="showPrivate = !showPrivate"
                  />
                </div>
                <div
                  v-if="showPrivate"
                  class="ax-key-box font-mono"
                  style="font-size: 0.72rem"
                >
                  {{ activeKey.privateKeyHex }}
                </div>
                <div v-else class="ax-key-box ax-key-box--redacted font-mono" style="font-size: 0.72rem">
                  {{ '●'.repeat(24) }} (click eye to reveal)
                </div>
              </div>
            </div>

            <div style="font-size: 0.68rem; color: var(--ax-text-dim); margin-top: 10px" class="font-mono">
              Created: {{ new Date(activeKey.createdAt).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAuthStore } from 'stores/auth';

const $q   = useQuasar();
const auth = useAuthStore();

const generating  = ref(false);
const showPrivate = ref(false);

const activeKey = computed(() => auth.getActiveKey());

async function generateKey() {
  generating.value = true;
  try {
    const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const privRaw = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
    const pubRaw  = await crypto.subtle.exportKey('raw',   kp.publicKey);

    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    auth.addKey({
      id:            crypto.randomUUID(),
      label:         'Key-' + (auth.keys.length + 1),
      privateKeyHex: toHex(privRaw),
      publicKeyHex:  toHex(pubRaw),
      createdAt:     Date.now(),
    });

    $q.notify({ message: 'New key pair generated', icon: 'key', color: 'positive', timeout: 2000 });
  } finally {
    generating.value = false;
  }
}

async function copyPub() {
  if (!activeKey.value) return;
  try {
    await navigator.clipboard.writeText(activeKey.value.publicKeyHex);
    $q.notify({ message: 'Public key copied', icon: 'check', color: 'positive', timeout: 1200 });
  } catch {
    $q.notify({ message: 'Copy failed', color: 'negative', timeout: 1200 });
  }
}
</script>

<style scoped>
.key-item {
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}
.key-item--active {
  background: var(--ax-primary-dim) !important;
  border-left-color: var(--ax-primary) !important;
}
</style>
