<template>
  <div class="ax-page" style="padding: 20px 24px; overflow-y: auto; height: 100%">

    <!-- ══════ HERO ══════════════════════════════════ -->
    <div style="margin-bottom: 20px">
      <h1 style="
        font-family: var(--ax-font-headline);
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--ax-on-surface);
        margin: 0 0 4px;
        letter-spacing: -0.02em;
      ">Identity Manager</h1>
      <p style="
        font-family: var(--ax-font-mono);
        font-size: 0.7rem;
        color: var(--ax-outline);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
      ">
        Actor identity · signing keys · context
      </p>
    </div>

    <!-- ══════ STAT CARDS ════════════════════════════ -->
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-bottom: 20px">
      <div class="ax-stat-card">
        <div class="ax-stat-label">Keys</div>
        <div class="ax-stat-value font-mono">{{ auth.keys.length }}</div>
      </div>
      <div class="ax-stat-card">
        <div class="ax-stat-label">Active Key</div>
        <div class="ax-stat-value font-mono" style="font-size: 0.7rem">{{ activeKey ? activeKey.label : 'None' }}</div>
      </div>
      <div class="ax-stat-card">
        <div class="ax-stat-label">Actor</div>
        <div class="ax-stat-value font-mono" style="font-size: 0.65rem; word-break: break-all">{{ auth.actorId || 'anonymous' }}</div>
      </div>
    </div>

    <div style="display: flex; gap: 16px; flex-wrap: wrap">

      <!-- ══════ IDENTITY PANEL ══════════════════════ -->
      <div style="flex: 1; min-width: 320px">
        <div class="ax-panel ax-panel-accent">
          <div class="ax-panel-header" style="display: flex; align-items: center; gap: 8px">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--ax-primary)">badge</span>
            <span class="ax-panel-title">Actor Identity</span>
          </div>
          <div style="padding: 14px">
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
            <div style="
              font-family: var(--ax-font-mono);
              font-size: 0.68rem;
              color: var(--ax-outline);
              margin-top: 10px;
              line-height: 1.5;
            ">
              The Actor ID is attached to every intent frame. Leave empty to
              send as <span style="color: var(--ax-primary)">studio:anonymous</span>.
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ SIGNING ENGINE ══════════════════════ -->
      <div style="flex: 1; min-width: 320px">
        <div class="ax-panel">
          <div class="ax-panel-header" style="display: flex; align-items: center; gap: 8px">
            <span class="material-symbols-outlined" style="font-size: 16px; color: var(--ax-primary)">key</span>
            <span class="ax-panel-title" style="flex: 1">Signing Keys</span>
            <q-btn
              flat dense round size="xs"
              :loading="generating"
              style="color: var(--ax-primary)"
              title="Generate new key pair"
              @click="generateKey"
            >
              <span class="material-symbols-outlined" style="font-size: 18px">add</span>
            </q-btn>
          </div>

          <div v-if="auth.keys.length" style="padding: 6px">
            <div
              v-for="k in auth.keys"
              :key="k.id"
              :class="['ax-key-row', { 'ax-key-row--active': auth.activeKeyId === k.id }]"
              @click="auth.setActive(k.id)"
            >
              <span class="material-symbols-outlined" style="font-size: 16px" :style="{
                color: auth.activeKeyId === k.id ? 'var(--ax-primary)' : 'var(--ax-outline)'
              }">{{ auth.activeKeyId === k.id ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>

              <div style="flex: 1; min-width: 0">
                <div style="font-size: 0.78rem; font-weight: 500; color: var(--ax-on-surface)">{{ k.label }}</div>
                <div class="font-mono" style="font-size: 0.62rem; color: var(--ax-outline); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ k.publicKeyHex.slice(0, 24) }}…
                </div>
              </div>

              <q-btn
                flat dense round size="xs"
                style="color: var(--ax-error)"
                @click.stop="auth.removeKey(k.id)"
              >
                <span class="material-symbols-outlined" style="font-size: 16px">delete</span>
              </q-btn>
            </div>
          </div>

          <div v-else class="ax-empty" style="padding: 32px 16px">
            <span class="material-symbols-outlined ax-empty-icon" style="font-size: 32px">vpn_key</span>
            <div class="ax-empty-text">No keys yet — click + to generate</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ ACTIVE KEY DETAIL ═══════════════════════════════════════ -->
    <div v-if="activeKey" style="margin-top: 16px">
      <div class="ax-panel">
        <div class="ax-panel-header" style="display: flex; align-items: center; gap: 8px">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--ax-primary)">fingerprint</span>
          <span class="ax-panel-title" style="flex: 1">Active Key — {{ activeKey.label }}</span>
          <q-btn
            flat dense no-caps size="xs"
            style="color: var(--ax-primary); font-family: var(--ax-font-mono); font-size: 0.65rem"
            @click="copyPub"
          >
            <span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px">content_copy</span>
            COPY PUBLIC KEY
          </q-btn>
        </div>

        <div style="padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px">
          <!-- Public key -->
          <div>
            <div style="
              font-family: var(--ax-font-mono);
              font-size: 0.65rem;
              font-weight: 700;
              color: var(--ax-outline);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 6px;
            ">Public Key (hex)</div>
            <div class="ax-key-box font-mono" style="font-size: 0.68rem">{{ activeKey.publicKeyHex }}</div>
          </div>

          <!-- Private key -->
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
              <span style="
                font-family: var(--ax-font-mono);
                font-size: 0.65rem;
                font-weight: 700;
                color: var(--ax-outline);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                flex: 1;
              ">Private Key (hex)</span>
              <q-btn
                flat dense round size="xs"
                :style="{ color: showPrivate ? 'var(--ax-warning)' : 'var(--ax-outline)' }"
                :title="showPrivate ? 'Hide' : 'Reveal'"
                @click="showPrivate = !showPrivate"
              >
                <span class="material-symbols-outlined" style="font-size: 16px">{{ showPrivate ? 'visibility_off' : 'visibility' }}</span>
              </q-btn>
            </div>
            <div
              v-if="showPrivate"
              class="ax-key-box font-mono"
              style="font-size: 0.68rem"
            >{{ activeKey.privateKeyHex }}</div>
            <div v-else class="ax-key-box font-mono" style="font-size: 0.68rem; color: var(--ax-outline)">
              {{ '●'.repeat(24) }} (click eye to reveal)
            </div>
          </div>
        </div>

        <div style="
          padding: 0 14px 12px;
          font-family: var(--ax-font-mono);
          font-size: 0.62rem;
          color: var(--ax-outline);
        ">Created: {{ new Date(activeKey.createdAt).toLocaleString() }}</div>
      </div>
    </div>

  </div>
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
.ax-key-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}
.ax-key-row:hover {
  background: var(--ax-surface-low);
}
.ax-key-row--active {
  background: var(--ax-surface-low);
}
</style>
