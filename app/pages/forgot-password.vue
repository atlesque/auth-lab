<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const email = ref('');
const busy = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  busy.value = true;
  const result = await authClient.requestPasswordReset({ email: email.value, redirectTo: '/reset-password' });
  busy.value = false;
  error.value = problem(result);
  sent.value = !error.value;
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Forgot it? <span aria-hidden="true">🤔</span></h1>
      <p class="font-semibold text-muted">No problem. We mail you a link.</p>
    </template>
    <UAlert v-if="sent" color="success" variant="subtle" icon="i-lucide-circle-check" :description="`If ${email} has an account, a link is on its way. It works for one hour.`" data-notice />
    <form v-else class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />
      <UFormField label="Email" name="email">
        <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
      </UFormField>
      <UButton type="submit" label="Send link" icon="i-lucide-send" size="xl" block :loading="busy" />
    </form>
    <template #footer>
      <NuxtLink to="/sign-in" class="font-semibold text-primary underline underline-offset-2">Back to sign in</NuxtLink>
    </template>
  </UCard>
</template>
