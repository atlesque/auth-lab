<script setup lang="ts">
definePageMeta({ layout: 'auth', buddy: 'party' });
const route = useRoute();
const lab = useLab();
const email = computed(() => String(route.query.email ?? ''));
const busy = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

async function resend() {
  busy.value = true;
  const result = await authClient.sendVerificationEmail({ email: email.value, callbackURL: confirmedPath(safePath(route.query.redirect)) });
  busy.value = false;
  error.value = problem(result);
  sent.value = !error.value;
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Check your mail! <span aria-hidden="true">📬</span></h1>
    </template>
    <div class="space-y-4">
      <p v-if="route.query.resent">Not confirmed yet. We sent a new link to <strong class="break-all text-highlighted">{{ email }}</strong>.</p>
      <p v-else>We sent a link to <strong class="break-all text-highlighted">{{ email }}</strong>. Tap it to finish.</p>
      <UAlert v-if="sent" color="success" variant="subtle" icon="i-lucide-circle-check" description="Sent again." />
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="error" />
      <div class="flex flex-wrap gap-2">
        <UButton label="Send again" icon="i-lucide-send" color="neutral" variant="outline" :loading="busy" @click="resend" />
        <UButton v-if="lab.dev" to="/dev/mailbox" label="Dev mailbox" icon="i-lucide-mail" color="neutral" variant="ghost" />
      </div>
    </div>
    <template #footer>
      <NuxtLink to="/sign-in" class="font-semibold text-primary underline underline-offset-2">Back to sign in</NuxtLink>
    </template>
  </UCard>
</template>
