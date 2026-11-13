<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const route = useRoute();
const lab = useLab();
const { refresh } = useAuth();
const buddy = useBuddy();
const confetti = useConfetti();

const redirect = computed(() => safePath(route.query.redirect));
const state = reactive({ email: '', password: '' });
const busy = ref<'password' | 'magic' | 'passkey' | 'github' | null>(null);
const error = ref<string | null>(route.query.error ? redirectProblem(route.query.error, { confirmation: !!route.query.confirmation }) : null);
const notice = ref<string | null>(null);
// The mascot frowns for a moment whenever something goes wrong.
watch(error, (message) => { if (message) buddy.flash('sad'); });

async function finish() {
  confetti();
  await refresh();
  await navigateTo(redirect.value);
}

async function withPassword() {
  error.value = notice.value = null;
  busy.value = 'password';
  const result = await authClient.signIn.email({ email: state.email, password: state.password });
  if (result.error?.status === 403 && result.error.code === 'EMAIL_NOT_VERIFIED') {
    // The password was right but the address is not confirmed: send a fresh confirmation link that leads where the
    // person was heading. (The server does not re-send by itself: its link would always point at the home page.)
    await authClient.sendVerificationEmail({ email: state.email, callbackURL: confirmedPath(redirect.value) });
  }
  busy.value = null;
  if (result.error) {
    if (result.error.status === 403 && result.error.code === 'EMAIL_NOT_VERIFIED') return navigateTo({ path: '/check-email', query: { email: state.email, resent: '1', ...(route.query.redirect ? { redirect: redirect.value } : {}) } });
    error.value = problem(result);
    return;
  }
  if ((result.data as { twoFactorRedirect?: boolean }).twoFactorRedirect) return navigateTo({ path: '/two-factor', query: { redirect: redirect.value } });
  await finish();
}

async function withMagicLink() {
  error.value = notice.value = null;
  if (!state.email) { error.value = 'Type your email first.'; return; }
  busy.value = 'magic';
  const result = await authClient.signIn.magicLink({ email: state.email, callbackURL: redirect.value, errorCallbackURL: '/sign-in' });
  busy.value = null;
  error.value = problem(result);
  if (!error.value) notice.value = 'Check your mail for a link. It works once, for 5 minutes.';
}

async function withPasskey() {
  error.value = notice.value = null;
  busy.value = 'passkey';
  const result = await authClient.signIn.passkey();
  busy.value = null;
  if (result?.error) { error.value = problem(result, 'No passkey used.'); return; }
  await finish();
}

async function withGithub() {
  busy.value = 'github';
  const result = await authClient.signIn.social({ provider: 'github', callbackURL: redirect.value, errorCallbackURL: '/sign-in' });
  busy.value = null;
  error.value = problem(result);
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Welcome back!</h1>
    </template>

    <form class="space-y-4" @submit.prevent="withPassword">
      <UAlert v-if="route.query.ended" color="info" variant="subtle" icon="i-lucide-info" description="You were signed out. Sign in again." data-notice />
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" data-error />
      <UAlert v-if="notice" color="success" variant="subtle" icon="i-lucide-circle-check" :description="notice" data-notice />
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="username webauthn" required class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password">
        <template #hint><NuxtLink to="/forgot-password" class="text-sm font-semibold text-primary underline underline-offset-2">Forgot?</NuxtLink></template>
        <UInput v-model="state.password" type="password" autocomplete="current-password" required class="w-full" @focus="buddy.set('shy')" @blur="buddy.set(null)" />
      </UFormField>
      <UButton type="submit" label="Sign in" size="xl" block :loading="busy === 'password'" :disabled="!!busy" />
    </form>

    <USeparator label="or" class="my-5" />

    <div class="grid gap-2" :class="lab.github ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
      <UButton label="Magic link" icon="i-lucide-wand-sparkles" color="neutral" variant="outline" block class="bg-candy-pink text-night hover:bg-candy-pink" :loading="busy === 'magic'" :disabled="!!busy" @click="withMagicLink" />
      <UButton label="Passkey" icon="i-lucide-key-round" color="neutral" variant="outline" block class="bg-candy-sky text-night hover:bg-candy-sky" :loading="busy === 'passkey'" :disabled="!!busy" @click="withPasskey" />
      <UButton v-if="lab.github" label="GitHub" icon="i-lucide-github" color="neutral" variant="outline" block class="bg-candy-lilac text-night hover:bg-candy-lilac" :loading="busy === 'github'" :disabled="!!busy" @click="withGithub" />
    </div>

    <template #footer>
      <p class="text-center font-semibold text-muted">
        New here?
        <NuxtLink :to="{ path: '/sign-up', query: route.query.redirect ? { redirect: redirect } : {} }" class="text-primary underline underline-offset-2">Join</NuxtLink>
      </p>
    </template>
  </UCard>
</template>
