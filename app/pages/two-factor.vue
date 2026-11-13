<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const route = useRoute();
const { refresh } = useAuth();
const buddy = useBuddy();
const confetti = useConfetti();
const redirect = computed(() => safePath(route.query.redirect));
const digits = ref<number[]>([]);
const backup = ref('');
const useBackup = ref(false);
const trust = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  busy.value = true;
  const result = useBackup.value
    ? await authClient.twoFactor.verifyBackupCode({ code: backup.value.trim(), trustDevice: trust.value })
    : await authClient.twoFactor.verifyTotp({ code: digits.value.join(''), trustDevice: trust.value });
  busy.value = false;
  if (result.error) {
    error.value = result.error.status === 429 ? 'Too many tries. Wait a minute.' : problem(result, 'Wrong code. Try again.');
    buddy.flash('sad');
    digits.value = [];
    return;
  }
  confetti();
  await refresh();
  await navigateTo(redirect.value);
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Secret code <span aria-hidden="true">🔢</span></h1>
      <p class="font-semibold text-muted">{{ useBackup ? 'Type one of your backup codes.' : 'Type the 6 numbers from your app.' }}</p>
    </template>
    <form class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" data-error />
      <UFormField v-if="useBackup" label="Backup code" name="backup">
        <UInput v-model="backup" autocomplete="off" required class="w-full font-mono" />
      </UFormField>
      <UFormField v-else label="Code" name="code">
        <UPinInput v-model="digits" :length="6" otp type="number" autofocus @complete="submit" />
      </UFormField>
      <UCheckbox v-model="trust" label="Remember this device for 30 days" />
      <UButton type="submit" label="Go" size="xl" block :loading="busy" />
      <UButton :label="useBackup ? 'Use the app' : 'Use a backup code'" variant="link" class="px-0" @click="useBackup = !useBackup" />
    </form>
    <template #footer>
      <NuxtLink to="/sign-in" class="font-semibold text-primary underline underline-offset-2">Start over</NuxtLink>
    </template>
  </UCard>
</template>
