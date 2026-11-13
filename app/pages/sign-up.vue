<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const route = useRoute();
const lab = useLab();
const redirect = computed(() => safePath(route.query.redirect));
const state = reactive({ name: '', email: '', password: '' });
const busy = ref(false);
const error = ref<string | null>(null);

async function submit() {
  error.value = null;
  busy.value = true;
  const result = await authClient.signUp.email({ name: state.name, email: state.email, password: state.password, callbackURL: confirmedPath(redirect.value) });
  busy.value = false;
  if (result.error) {
    error.value = problem(result);
    return;
  }
  await navigateTo({ path: '/check-email', query: { email: state.email, ...(route.query.redirect ? { redirect: redirect.value } : {}) } });
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Join in!</h1>
    </template>

    <form class="space-y-4" @submit.prevent="submit">
      <UAlert v-if="!lab.signupOpen" color="info" variant="subtle" icon="i-lucide-info" description="Invite-only for now." />
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" data-error />
      <UFormField label="Name" name="name">
        <UInput v-model="state.name" autocomplete="name" required maxlength="80" class="w-full" />
      </UFormField>
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" required class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password" help="10 or more letters.">
        <UInput v-model="state.password" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
      </UFormField>
      <UButton type="submit" label="Let’s go" size="xl" color="secondary" block :loading="busy" />
    </form>

    <template #footer>
      <p class="text-center font-semibold text-muted">
        Been here before?
        <NuxtLink :to="{ path: '/sign-in', query: route.query.redirect ? { redirect: redirect } : {} }" class="text-primary underline underline-offset-2">Sign in</NuxtLink>
      </p>
    </template>
  </UCard>
</template>
