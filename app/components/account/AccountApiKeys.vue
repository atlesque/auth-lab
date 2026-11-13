<script setup lang="ts">
// better-auth's API key plugin. In this app a key can only list the notes of a team you belong to.
interface Key { id: string; name?: string | null; start?: string | null; createdAt: string | Date; lastRequest?: string | Date | null }
const toast = useToast();
const keys = ref<Key[]>([]);
const loading = ref(true);
const name = ref('');
const busy = ref(false);
const created = ref<string | null>(null);
const origin = window.location.origin;

async function load() {
  const result = await authClient.apiKey.list();
  const data = result.data as { apiKeys?: Key[] } | Key[] | null;
  keys.value = (Array.isArray(data) ? data : data?.apiKeys) ?? [];
  loading.value = false;
}
onMounted(load);

async function create() {
  busy.value = true;
  const result = await authClient.apiKey.create({ name: name.value.trim() });
  busy.value = false;
  const error = problem(result);
  if (error) return toast.add({ title: 'Could not make the key', description: error, color: 'error' });
  created.value = result.data?.key ?? null;
  name.value = '';
  await load();
}
async function remove(key: Key) {
  const error = problem(await authClient.apiKey.delete({ keyId: key.id }));
  if (error) toast.add({ title: 'Could not delete the key', description: error, color: 'error' });
  await load();
}
async function copy() {
  if (!created.value) return;
  await navigator.clipboard.writeText(created.value);
  toast.add({ title: 'Copied', color: 'success' });
}
</script>

<template>
  <AccountSection emoji="🤖" title="API keys" tint="bg-candy-sky" :badge="loading ? null : keys.length">
    <p class="font-semibold text-muted">Lets a script read your team’s notes.</p>
    <div v-if="created" class="space-y-2 rounded-xl border-2 border-success bg-success/10 p-4" data-new-key>
      <p class="font-display font-semibold text-highlighted">Copy it now. You will not see it again.</p>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 rounded-md bg-default px-2.5 py-1.5 text-xs break-all" data-key-value>{{ created }}</code>
        <UButton icon="i-lucide-copy" color="neutral" variant="outline" size="sm" square aria-label="Copy the key" @click="copy" />
      </div>
      <pre class="overflow-x-auto rounded-md bg-default px-2.5 py-1.5 text-xs">curl -H "x-api-key: {{ created }}" {{ origin }}/api/notes</pre>
    </div>
    <USkeleton v-if="loading" class="h-10 w-full" />
    <ul v-else-if="keys.length" class="space-y-2">
      <li v-for="key in keys" :key="key.id" class="flex items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5" data-api-key>
        <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-display font-semibold text-highlighted [overflow-wrap:anywhere]">{{ key.name || 'No name' }}</p>
          <p class="text-xs font-semibold text-muted [overflow-wrap:anywhere]"><span class="font-mono">{{ key.start }}…</span> · since {{ formatDate(key.createdAt) }}<template v-if="key.lastRequest"> · used {{ formatDate(key.lastRequest) }}</template></p>
        </div>
        <UButton label="Delete" size="sm" color="neutral" variant="ghost" @click="remove(key)" />
      </li>
    </ul>
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="create">
      <UInput v-model="name" placeholder="Name, like “backup”" required maxlength="40" class="sm:flex-1" aria-label="Key name" />
      <UButton type="submit" label="Make key" icon="i-lucide-plus" :loading="busy" />
    </form>
  </AccountSection>
</template>
