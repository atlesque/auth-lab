<script setup lang="ts">
import { ConfirmModal } from '#components';

// null while the Account page is still finding out whether this account has a password.
defineProps<{ hasPassword: boolean | null }>();
const { current } = useAuth();
const overlay = useOverlay();
const password = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

async function remove() {
  error.value = null;
  const confirmed = await overlay.create(ConfirmModal).open({ title: 'Really delete?', body: 'You, your keys and your notes go away. There is no undo.', confirmLabel: 'Delete my account', danger: true }).result;
  if (!confirmed) return;
  busy.value = true;
  // Without a password on the account there is nothing to ask for; the server accepts a recent session instead.
  const result = await authClient.deleteUser(password.value ? { password: password.value } : {});
  busy.value = false;
  error.value = problem(result);
  if (error.value) return;
  current.value = null;
  await navigateTo('/?deleted=1');
}
</script>

<template>
  <AccountSection emoji="💥" title="Delete account" tint="bg-error/30">
    <p class="font-semibold text-muted">This deletes you, your keys and your notes. Delete teams you own alone first.</p>
    <USkeleton v-if="hasPassword === null" class="h-10 w-full" />
    <form v-else class="flex flex-wrap items-end gap-2" @submit.prevent="remove">
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" class="w-full" />
      <UFormField v-if="hasPassword" label="Your password" name="password" class="min-w-48 flex-1">
        <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UButton type="submit" label="Delete my account" icon="i-lucide-trash-2" color="error" variant="outline" :loading="busy" />
    </form>
  </AccountSection>
</template>
