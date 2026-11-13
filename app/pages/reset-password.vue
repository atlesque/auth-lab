<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const route = useRoute();
const toast = useToast();
const buddy = useBuddy();
const token = computed(() => String(route.query.token ?? ''));
// The link can also turn out to be bad only when saving (a made-up or already used token).
const tokenRejected = ref(false);
const invalid = computed(() => !!route.query.error || !token.value || tokenRejected.value);
const password = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  busy.value = true;
  const result = await authClient.resetPassword({ newPassword: password.value, token: token.value });
  busy.value = false;
  if (result.error?.code === 'INVALID_TOKEN' || result.error?.code === 'TOKEN_EXPIRED') { tokenRejected.value = true; return; }
  error.value = problem(result);
  if (error.value) return;
  toast.add({ title: 'Password changed', description: 'Sign in with the new one.', color: 'success' });
  await navigateTo('/sign-in');
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">New password</h1>
    </template>
    <div v-if="invalid" class="space-y-4">
      <UAlert color="error" variant="subtle" icon="i-lucide-triangle-alert" description="This link is too old or was used already." />
      <UButton to="/forgot-password" label="Get a new link" />
    </div>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />
      <UFormField label="New password" name="password" help="10 or more letters.">
        <UInput v-model="password" type="password" autocomplete="new-password" required minlength="10" class="w-full" @focus="buddy.set('shy')" @blur="buddy.set(null)" />
      </UFormField>
      <UButton type="submit" label="Save" size="xl" block :loading="busy" />
    </form>
  </UCard>
</template>
