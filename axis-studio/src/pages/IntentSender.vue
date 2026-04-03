<template>
  <div class="h-full flex flex-col bg-background font-body">
    <!-- ══════ INTERFACE HEADER / INTENT SELECTOR ════════════ -->
    <div class="p-6 border-b border-white/5 bg-[#111318]/50 backdrop-blur-sm">
      <div class="flex items-center gap-4">
        <div
          class="flex-1 flex items-center bg-[#1A1C20] border border-white/10 px-4 py-2 hover:border-[#00F5FF]/30 transition-all group"
        >
          <div
            class="flex items-center gap-2 pr-4 border-r border-white/5 mr-4"
          >
            <span
              class="font-mono text-[10px] text-[#00F5FF] font-bold tracking-widest"
              >AXIS</span
            >
            <span
              class="material-symbols-outlined text-on-surface-variant/40 scale-75"
              >expand_more</span
            >
          </div>

          <q-select
            v-model="intent"
            :options="filteredOpts"
            use-input
            fill-input
            hide-selected
            input-debounce="80"
            new-value-mode="add-unique"
            borderless
            dense
            hide-bottom-space
            class="flex-1"
            input-class="font-mono text-sm text-[#00F5FF] placeholder:text-on-surface-variant/20"
            popup-content-class="bg-[#1A1C20] border border-white/10 text-on-surface font-mono text-sm shadow-2xl"
            placeholder="OPERATIONAL_INTENT_IDENTIFIER..."
            @filter="filterIntents"
          >
            <template #selected-item="{ opt }">
              <span class="font-mono text-sm text-[#00F5FF] truncate">{{
                opt
              }}</span>
            </template>
            <template #option="{ itemProps, opt }">
              <q-item
                v-bind="itemProps"
                dense
                class="hover:bg-[#00F5FF]/5 transition-colors"
              >
                <q-item-section>
                  <q-item-label class="font-mono text-xs">{{
                    opt
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <button
            class="ml-4 px-6 py-2 bg-primary-container text-on-primary-fixed font-headline font-black text-[11px] uppercase tracking-[0.2em] hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 group-hover:shadow-[0_0_15px_rgba(0,245,255,0.2)] disabled:opacity-50 disabled:pointer-events-none"
            :disabled="!intent || sending"
            @click="send"
          >
            <q-spinner v-if="sending" size="14px" />
            <span v-else class="material-symbols-outlined text-sm">bolt</span>
            {{ sending ? "EXECUTING…" : "EXECUTE" }}
          </button>
        </div>

        <button
          class="w-10 h-10 flex items-center justify-center text-on-surface-variant/40 hover:text-on-surface transition-colors"
          @click="clearForm"
          title="Reset Buffer"
        >
          <span class="material-symbols-outlined">restart_alt</span>
        </button>
      </div>

      <!-- Quick Picks -->
      <div class="flex flex-wrap gap-2 mt-4">
        <button
          v-for="q in quickPicks"
          :key="q"
          class="px-2 py-1 bg-surface-container-low border border-white/5 text-[9px] font-mono text-on-surface-variant/60 hover:text-[#00F5FF] hover:border-[#00F5FF]/20 transition-all uppercase tracking-tighter"
          @click="intent = q"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <!-- ══════ MAIN WORKSPACE SPLIT ══════════════════════════ -->
    <div class="flex-1 flex overflow-hidden min-h-0 divide-x divide-white/5">
      <!-- LEFT PANE: INTENT COMPOSER -->
      <div class="w-[45%] flex flex-col min-w-[320px] bg-background">
        <div
          class="h-10 flex items-center px-4 bg-[#111318]/30 border-b border-white/5"
        >
          <div class="flex items-center gap-6">
            <button
              v-for="tab in ['body', 'context', 'auth'] as const"
              :key="tab"
              class="text-[10px] font-mono uppercase tracking-[0.15em] transition-all relative py-2"
              :class="
                reqTab === tab
                  ? 'text-[#00F5FF] font-bold'
                  : 'text-on-surface-variant/40 hover:text-on-surface'
              "
              @click="reqTab = tab"
            >
              {{ tab }}
              <div
                v-if="reqTab === tab"
                class="absolute bottom-0 left-0 w-full h-0.5 bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]"
              ></div>
            </button>
          </div>
        </div>

        <div class="flex-1 relative overflow-hidden flex flex-col">
          <div
            v-show="reqTab === 'body'"
            class="flex-1 flex flex-col overflow-hidden"
          >
            <JsonEditor
              v-model="bodyText"
              class="flex-1"
              :show-line-numbers="true"
            />
            <div
              class="h-6 px-4 bg-[#111318] flex items-center justify-between border-t border-white/5 font-mono text-[9px] text-on-surface-variant/30 uppercase"
            >
              <span>CTRL+ENTER TO DISPATCH</span>
              <span>SIZE: {{ bodyByteSize }}</span>
            </div>
          </div>

          <div
            v-show="reqTab === 'context'"
            class="p-6 space-y-6 overflow-y-auto"
          >
            <div
              v-for="(val, label) in {
                'Actor ID': auth.actorId || 'studio:anonymous',
                'Capsule ID': auth.capsuleId || 'None',
              }"
              :key="label"
              class="space-y-2"
            >
              <label
                class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest"
                >{{ label }}</label
              >
              <div
                class="p-3 bg-[#1A1C20] border border-white/5 font-mono text-xs text-on-surface break-all select-all"
              >
                {{ val }}
              </div>
            </div>
            <router-link
              to="/auth"
              class="inline-block text-[10px] font-mono text-primary-container hover:text-[#00F5FF] uppercase underline underline-offset-4"
              >Modify Chain Context →</router-link
            >
          </div>

          <div v-show="reqTab === 'auth'" class="p-6 space-y-6">
            <div class="space-y-2">
              <label
                class="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest"
                >Active Proof Type</label
              >
              <div
                class="p-3 bg-[#1A1C20] border border-white/5 font-mono text-xs text-[#00F5FF]"
              >
                CAPSULE_BINDING_V1
              </div>
            </div>
            <p
              class="text-[10px] text-on-surface-variant/40 font-mono italic leading-relaxed"
            >
              All frames are automatically signed using the active identity
              provider. Proof of execution is embedded in the frame header.
            </p>
          </div>
        </div>
      </div>

      <!-- RIGHT PANE: FEEDBACK / RESPONSE -->
      <div class="flex-1 flex flex-col bg-[#0A0C10]">
        <div
          class="h-10 flex items-center justify-between px-4 bg-[#111318]/30 border-b border-white/5"
        >
          <div class="flex items-center gap-6">
            <button
              v-for="tab in ['tree', 'raw'] as const"
              :key="tab"
              class="text-[10px] font-mono uppercase tracking-[0.15em] transition-all relative py-2"
              :class="
                viewTab === tab
                  ? 'text-[#00F5FF] font-bold'
                  : 'text-on-surface-variant/40 hover:text-on-surface'
              "
              @click="viewTab = tab"
            >
              {{ tab === "tree" ? "Preview" : "Raw" }}
              <div
                v-if="viewTab === tab"
                class="absolute bottom-0 left-0 w-full h-0.5 bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]"
              ></div>
            </button>
          </div>

          <div v-if="lastResult" class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="lastResult.ok ? 'bg-primary-container' : 'bg-error'"
              ></span>
              <span
                class="font-mono text-[10px] uppercase font-bold"
                :class="lastResult.ok ? 'text-primary-container' : 'text-error'"
              >
                {{ lastResult.ok ? "200 OK" : "ERR " + lastResult.status }}
              </span>
            </div>
            <span
              class="font-mono text-[10px] text-on-surface-variant/40 uppercase"
              >{{ lastResult.durationMs }}ms</span
            >
          </div>
        </div>

        <div class="flex-1 relative overflow-hidden bg-background/20">
          <div v-show="viewTab === 'tree'" class="h-full overflow-hidden">
            <JsonTree
              v-if="lastResult?.response"
              :value="lastResult.response"
              class="h-full border-none"
            />
            <div
              v-else
              class="h-full flex flex-col items-center justify-center opacity-20 group"
            >
              <span
                class="material-symbols-outlined text-6xl mb-4 group-hover:scale-110 transition-transform duration-500"
                >terminal</span
              >
              <p class="font-mono text-xs uppercase tracking-[0.3em]">
                {{
                  sending ? "Intercepting Frame..." : "Idle - Awaiting Intent"
                }}
              </p>
            </div>
          </div>

          <div
            v-show="viewTab === 'raw'"
            class="p-6 font-mono text-xs text-on-surface-variant/80 selection:bg-[#00F5FF]/30 overflow-auto h-full leading-relaxed custom-scrollbar"
          >
            <pre v-if="lastResult">{{ lastResult.raw }}</pre>
            <div
              v-else
              class="h-full flex flex-col items-center justify-center opacity-10"
            >
              <span class="material-symbols-outlined text-6xl mb-4"
                >analytics</span
              >
            </div>
          </div>
        </div>

        <!-- Result Bar (Effect) -->
        <div
          v-if="lastResult?.effect"
          class="h-10 bg-surface-container-low border-t border-white/5 px-6 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span
              class="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest"
              >Protocol Effect:</span
            >
            <span
              class="px-2 py-0.5 bg-primary-container/10 border border-primary-container/20 text-[#00F5FF] font-mono font-bold text-[10px] tracking-wider uppercase"
            >
              {{ lastResult.effect }}
            </span>
          </div>
          <button
            class="text-[9px] font-mono text-on-surface-variant/40 hover:text-on-surface uppercase tracking-tighter"
            @click="
              router.push({ path: '/history', query: { intent: intent } })
            "
          >
            View Receipt Chain ↘
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar } from "quasar";
import JsonEditor from "src/components/JsonEditor.vue";
import JsonTree from "src/components/JsonTree.vue";
import {
  sendIntent,
  fetchCatalog,
  type SendResult,
} from "src/services/axis-client";
import { useAuthStore } from "stores/auth";

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const intent = ref<string>("catalog.list");
const bodyText = ref("{\n  \n}");
const sending = ref(false);
const lastResult = ref<SendResult | null>(null);
const viewTab = ref<"tree" | "raw">("tree");
const reqTab = ref<"body" | "context" | "auth">("body");

const quickPicks = [
  "catalog.list",
  "catalog.describe",
  "catalog.search",
  "axis.sessions.list",
  "axis.identities.list",
  "axis.capsules.list",
];

const allOpts = ref<string[]>([...quickPicks]);
const filteredOpts = ref<string[]>([...quickPicks]);

function filterIntents(val: string, update: (fn: () => void) => void) {
  update(() => {
    const q = val.toLowerCase();
    filteredOpts.value = q
      ? allOpts.value.filter((i) => i.toLowerCase().includes(q)).slice(0, 60)
      : allOpts.value.slice(0, 60);
  });
}

onMounted(async () => {
  try {
    const catalog = await fetchCatalog();
    allOpts.value = catalog.map((i) => i.intent);
    filteredOpts.value = allOpts.value.slice(0, 60);
  } catch {
    /* keep quickPicks */
  }

  const qi = route.query.intent as string | undefined;
  if (qi) intent.value = qi;
});

const bodyByteSize = computed(() => {
  const bytes = new TextEncoder().encode(bodyText.value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
});

function clearForm() {
  intent.value = "";
  bodyText.value = "{\n  \n}";
  lastResult.value = null;
}

async function send() {
  if (!intent.value) return;
  sending.value = true;
  try {
    let body: Record<string, unknown> = {};
    const trimmed = bodyText.value.trim();
    if (trimmed && trimmed !== "{}") {
      body = JSON.parse(trimmed);
    }
    lastResult.value = await sendIntent(intent.value, body);
    viewTab.value = "tree";
  } catch (e: any) {
    lastResult.value = {
      ok: false,
      status: 0,
      durationMs: 0,
      response: { error: e.message },
      raw: e.message,
      effect: "PARSE_ERROR",
    };
    $q.notify({
      message: e.message,
      color: "negative",
      icon: "error",
      timeout: 3000,
    });
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 245, 255, 0.2);
}
</style>
