<script setup lang="ts">
// Authenticator-app codes (TOTP) with backup codes. Turning it on or off asks for the password again.
import { renderSVG } from 'uqr';

// null while the Account page is still finding out whether this account has a password.
defineProps<{ hasPassword: boolean | null }>();
const { user, refresh } = useAuth();
const enabled = computed(() => !!user.value?.twoFactorEnabled);
const password = ref('');
const digits = ref<number[]>([]);
const setup = ref<{ uri: string; secret: string; qr: string; codes: string[] } | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const confetti = useConfetti();

async function start() {
  error.value = null;
  busy.value = true;
  const result = await authClient.twoFactor.enable({ password: password.value });
  busy.value = false;
  error.value = problem(result);
  if (!result.data || !('totpURI' in result.data)) return;
  const uri = result.data.totpURI;
  setup.value = {
    uri,
    secret: new URL(uri).searchParams.get('secret') ?? '',
    qr: `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(uri, { border: 2 }))}`,
    codes: result.data.backupCodes,
  };
  password.value = '';
}

async function confirm() {
  error.value = null;
  busy.value = true;
  const result = await authClient.twoFactor.verifyTotp({ code: digits.value.join('') });
  busy.value = false;
  error.value = problem(result, 'Wrong code. Try again.');
  digits.value = [];
  if (error.value) return;
  confetti();
  await refresh();
}

async function disable() {
  error.value = null;
  busy.value = true;
  const result = await authClient.twoFactor.disable({ password: password.value });
  busy.value = false;
  error.value = problem(result);
  if (error.value) return;
  password.value = '';
  setup.value = null;
  await refresh();
}
</script>

<template>
  <AccountSection emoji="🔢" title="2-step code" tint="bg-candy-mint" :badge="enabled ? 'On' : 'Off'" :badge-color="enabled ? 'success' : 'neutral'" data-two-factor>
    <p class="font-semibold text-muted">Asks for a 6-number code when you sign in with your password.</p>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />

    <template v-if="enabled">
      <div v-if="setup" class="space-y-2">
        <p class="font-display font-semibold text-highlighted">Backup codes <span aria-hidden="true">🛟</span></p>
        <p class="text-sm font-semibold text-muted">Save these now. Each works once.</p>
        <ul class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-4 font-mono text-sm sm:grid-cols-5" data-backup-codes>
          <li v-for="code in setup.codes" :key="code">{{ code }}</li>
        </ul>
      </div>
      <form class="flex flex-wrap items-end gap-2" @submit.prevent="disable">
        <UFormField label="Your password" name="password" class="min-w-48 flex-1">
          <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
        </UFormField>
        <UButton type="submit" label="Turn off" color="error" variant="outline" :loading="busy" />
      </form>
    </template>

    <template v-else-if="setup">
      <div class="flex flex-wrap items-start gap-4">
        <img :src="setup.qr" alt="QR code to scan with your code app" width="168" height="168" class="pop-sm rounded-lg bg-white">
        <div class="min-w-0 flex-1 space-y-3">
          <p class="font-semibold">Scan this with your code app. Or type this key:</p>
          <p class="rounded-lg bg-elevated px-3 py-2 font-mono text-sm break-all" data-totp-secret>{{ setup.secret }}</p>
          <form class="space-y-3" @submit.prevent="confirm">
            <UFormField label="Code from the app" name="code">
              <UPinInput v-model="digits" :length="6" otp type="number" @complete="confirm" />
            </UFormField>
            <UButton type="submit" label="Turn on" :loading="busy" />
          </form>
        </div>
      </div>
    </template>

    <USkeleton v-else-if="hasPassword === null" class="h-10 w-full" />
    <p v-else-if="!hasPassword" class="font-semibold text-muted" data-two-factor-needs-password>This needs a password first. Sign out and tap “Forgot?” to add one.</p>

    <form v-else class="flex flex-wrap items-end gap-2" @submit.prevent="start">
      <UFormField label="Your password" name="password" class="min-w-48 flex-1">
        <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UButton type="submit" label="Set up" :loading="busy" />
    </form>
  </AccountSection>
</template>
