<script setup lang="ts">
defineProps<{ hasPassword: boolean | null }>();
const emit = defineEmits<{ changed: [] }>();
const toast = useToast();
const state = reactive({ current: '', next: '', revoke: true });
const busy = ref(false);
const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  busy.value = true;
  const result = await authClient.changePassword({ currentPassword: state.current, newPassword: state.next, revokeOtherSessions: state.revoke });
  busy.value = false;
  error.value = problem(result);
  if (error.value) return;
  state.current = state.next = '';
  toast.add({ title: 'Password changed', color: 'success' });
  emit('changed');
}
</script>

<template>
  <AccountSection emoji="🔒" title="Password" tint="bg-candy-yellow">
    <USkeleton v-if="hasPassword === null" class="h-10 w-full" />
    <p v-else-if="!hasPassword" class="font-semibold text-muted" data-no-password>You sign in without a password. To add one, sign out and tap “Forgot?”.</p>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Old password" name="current">
          <UInput v-model="state.current" type="password" autocomplete="current-password" required class="w-full" />
        </UFormField>
        <UFormField label="New password" name="next" help="10 or more letters.">
          <UInput v-model="state.next" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
        </UFormField>
      </div>
      <UCheckbox v-model="state.revoke" label="Sign out my other devices" />
      <UButton type="submit" label="Change" :loading="busy" />
    </form>
  </AccountSection>
</template>
