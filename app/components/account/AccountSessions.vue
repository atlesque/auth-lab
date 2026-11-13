<script setup lang="ts">
interface Row { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: string | Date; expiresAt: string | Date }
const props = defineProps<{ readOnly?: boolean }>();
const { current } = useAuth();
const toast = useToast();
const sessions = ref<Row[]>([]);
const loading = ref(true);

async function load() {
  const result = await authClient.listSessions();
  sessions.value = ((result.data ?? []) as Row[]).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  loading.value = false;
}
onMounted(load);
defineExpose({ load });

// "Chrome on macOS" from the user agent; the full string stays in the title.
function device(agent?: string | null) {
  if (!agent) return 'Unknown device';
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : /node|undici/i.test(agent) ? 'A script' : 'A browser';
  const system = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : '';
  return system ? `${browser} on ${system}` : browser;
}

async function revoke(row: Row) {
  const error = problem(await authClient.revokeSession({ token: row.token }));
  if (error) toast.add({ title: 'Could not sign it out', description: error, color: 'error' });
  await load();
}
async function revokeOthers() {
  const error = problem(await authClient.revokeOtherSessions());
  if (error) toast.add({ title: 'Could not sign them out', description: error, color: 'error' });
  await load();
}
</script>

<template>
  <AccountSection emoji="📱" title="Devices" tint="bg-candy-orange" :badge="loading ? null : sessions.length">
    <USkeleton v-if="loading" class="h-10 w-full" />
    <ul v-else class="space-y-2">
      <li v-for="row in sessions" :key="row.id" class="flex items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5" data-session>
        <UIcon name="i-lucide-smartphone" class="size-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-display font-semibold text-highlighted" :title="row.userAgent ?? undefined">{{ device(row.userAgent) }}</p>
          <p class="text-xs font-semibold text-muted [overflow-wrap:anywhere]">{{ row.ipAddress || 'Unknown place' }} · since {{ formatDate(row.createdAt) }}</p>
        </div>
        <UBadge v-if="row.token === current?.session.token" label="This one" color="success" variant="subtle" />
        <UButton v-else-if="!props.readOnly" label="Sign out" size="sm" color="neutral" variant="ghost" @click="revoke(row)" />
      </li>
    </ul>
    <UButton v-if="!props.readOnly && sessions.length > 1" label="Sign out the others" icon="i-lucide-log-out" color="neutral" variant="outline" @click="revokeOthers" />
  </AccountSection>
</template>
