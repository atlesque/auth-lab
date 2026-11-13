<script setup lang="ts">
interface Passkey { id: string; name?: string | null; deviceType: string; createdAt?: string | Date | null }
const toast = useToast();
const passkeys = ref<Passkey[]>([]);
const loading = ref(true);
const name = ref('');
const busy = ref(false);
const confetti = useConfetti();

async function load() {
  const result = await authClient.passkey.listUserPasskeys();
  passkeys.value = (result.data ?? []) as Passkey[];
  loading.value = false;
}
onMounted(load);

async function add() {
  busy.value = true;
  const result = await authClient.passkey.addPasskey({ name: name.value.trim() || undefined });
  busy.value = false;
  const error = result?.error ? problem(result, 'No passkey made.') : null;
  if (error) return toast.add({ title: 'Could not add the passkey', description: error, color: 'error' });
  name.value = '';
  confetti(30);
  await load();
}
async function remove(passkey: Passkey) {
  const error = problem(await authClient.passkey.deletePasskey({ id: passkey.id }));
  if (error) toast.add({ title: 'Could not remove the passkey', description: error, color: 'error' });
  await load();
}
</script>

<template>
  <AccountSection emoji="🗝️" title="Passkeys" tint="bg-candy-lilac" :badge="loading ? null : passkeys.length">
    <p class="font-semibold text-muted">Sign in with your face, finger or a key.</p>
    <USkeleton v-if="loading" class="h-10 w-full" />
    <ul v-else-if="passkeys.length" class="space-y-2">
      <li v-for="passkey in passkeys" :key="passkey.id" class="flex items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5" data-passkey>
        <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-display font-semibold text-highlighted [overflow-wrap:anywhere]">{{ passkey.name || 'Passkey' }}</p>
          <p class="text-xs font-semibold text-muted">{{ passkey.deviceType === 'multiDevice' ? 'Synced' : 'This device only' }}<template v-if="passkey.createdAt"> · since {{ formatDate(passkey.createdAt) }}</template></p>
        </div>
        <UButton label="Remove" size="sm" color="neutral" variant="ghost" @click="remove(passkey)" />
      </li>
    </ul>
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="add">
      <UInput v-model="name" placeholder="Name, like “MacBook”" maxlength="40" class="sm:flex-1" aria-label="Passkey name" />
      <UButton type="submit" label="Add passkey" icon="i-lucide-plus" :loading="busy" />
    </form>
  </AccountSection>
</template>
