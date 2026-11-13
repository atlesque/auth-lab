<script setup lang="ts">
// Local development only: every email the Worker "sent", newest first (DEV_MAILBOX=1 in wrangler.jsonc's dev env).
definePageMeta({ layout: 'auth' });
interface Message { id: number; recipient: string; subject: string; kind: string; url: string; createdAt: string }
const messages = ref<Message[]>([]);
const error = ref<string | null>(null);

async function load() {
  try {
    messages.value = (await api<{ messages: Message[] }>('/dev/outbox')).messages;
    error.value = null;
  } catch (cause) {
    error.value = errorMessage(cause);
  }
}
async function clear() {
  await api('/dev/outbox', { method: 'DELETE' });
  await load();
}
onMounted(load);
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-highlighted">Dev mailbox <span aria-hidden="true">📮</span></h1>
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" square aria-label="Refresh" class="ms-auto" @click="load" />
        <UButton label="Clear" color="neutral" variant="outline" size="sm" @click="clear" />
      </div>
      <p class="font-semibold text-muted">On a local run, mail lands here.</p>
    </template>
    <UAlert v-if="error" color="warning" variant="subtle" icon="i-lucide-info" title="Not here" description="This only works on a local run." />
    <p v-else-if="!messages.length" class="font-semibold text-muted">No mail yet.</p>
    <ul v-else class="divide-y divide-default">
      <li v-for="message in messages" :key="message.id" class="space-y-1.5 py-3 first:pt-0 last:pb-0" data-message>
        <p class="font-display font-semibold text-highlighted">{{ message.subject }}</p>
        <p class="text-xs font-semibold text-muted [overflow-wrap:anywhere]">To {{ message.recipient }} · {{ formatDate(message.createdAt) }}</p>
        <UButton :to="message.url" external :label="`Open the ${message.kind.replace('-', ' ')} link`" size="sm" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right" />
      </li>
    </ul>
  </UCard>
</template>
