<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <!-- Identity settings -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">Identity</div>

            <q-input
              v-model="auth.actorId"
              label="Actor ID"
              dense
              outlined
              dark
              placeholder="actor:user_abc123"
              class="q-mb-sm"
              @update:model-value="
                (v: string | number | null) => auth.setActorId(String(v ?? ''))
              "
            />

            <q-input
              v-model="auth.capsuleId"
              label="Capsule ID"
              dense
              outlined
              dark
              placeholder="(optional)"
              class="q-mb-sm"
              @update:model-value="
                (v: string | number | null) =>
                  auth.setCapsuleId(String(v ?? ''))
              "
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- Signing keys -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6 text-primary">Signing Keys</div>
              <q-space />
              <q-btn
                flat
                dense
                icon="add"
                color="primary"
                @click="generateKey"
                :loading="generating"
              />
            </div>

            <q-list separator dense>
              <q-item
                v-for="k in auth.keys"
                :key="k.id"
                :active="auth.activeKeyId === k.id"
                active-class="text-primary bg-grey-10"
                clickable
                v-ripple
                @click="auth.setActive(k.id)"
              >
                <q-item-section avatar>
                  <q-icon
                    :name="
                      auth.activeKeyId === k.id
                        ? 'radio_button_checked'
                        : 'radio_button_unchecked'
                    "
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ k.label }}</q-item-label>
                  <q-item-label caption class="font-mono"
                    >{{ k.publicKeyHex.slice(0, 16) }}…</q-item-label
                  >
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    dense
                    round
                    icon="delete"
                    size="sm"
                    color="negative"
                    @click.stop="auth.removeKey(k.id)"
                  />
                </q-item-section>
              </q-item>

              <q-item v-if="!auth.keys.length">
                <q-item-section class="text-grey-6 text-center">
                  No keys yet — click + to generate one
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- Key detail -->
      <div class="col-12" v-if="activeKey">
        <q-card flat bordered class="bg-dark">
          <q-card-section>
            <div class="text-subtitle2 text-grey-5 q-mb-xs">
              Active Key: {{ activeKey.label }}
            </div>
            <div class="text-caption text-grey-5">Public Key (hex)</div>
            <pre class="response-hex q-pa-xs q-mb-sm">{{
              activeKey.publicKeyHex
            }}</pre>
            <div class="text-caption text-grey-5">Private Key (hex)</div>
            <div class="row items-center">
              <pre
                v-if="showPrivate"
                class="response-hex q-pa-xs"
                style="flex: 1"
                >{{ activeKey.privateKeyHex }}</pre
              >
              <pre
                v-else
                class="response-hex q-pa-xs text-grey-7"
                style="flex: 1"
              >
●●●●●●●●●●●●●●●● (click to reveal)</pre
              >
              <q-btn
                flat
                dense
                :icon="showPrivate ? 'visibility_off' : 'visibility'"
                @click="showPrivate = !showPrivate"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from 'stores/auth';

const auth = useAuthStore();
const generating = ref(false);
const showPrivate = ref(false);

const activeKey = computed(() => auth.getActiveKey());

async function generateKey() {
  generating.value = true;
  try {
    // Use Web Crypto to generate Ed25519 key pair
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify',
    ]);
    const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);

    const privHex = Array.from(new Uint8Array(privRaw))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const pubHex = Array.from(new Uint8Array(pubRaw))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const id = crypto.randomUUID();
    auth.addKey({
      id,
      label: `Key-${auth.keys.length + 1}`,
      privateKeyHex: privHex,
      publicKeyHex: pubHex,
      createdAt: Date.now(),
    });
  } finally {
    generating.value = false;
  }
}
</script>
