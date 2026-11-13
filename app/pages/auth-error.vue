<script setup lang="ts">
// Where better-auth sends a redirect flow that failed without a page of its own to return to (see onAPIError in
// worker/options.ts). The reason arrives as ?error=<code>.
definePageMeta({ layout: 'auth', buddy: 'sad' });
const route = useRoute();
const { user } = useAuth();
const reason = computed(() => redirectProblem(route.query.error));
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">Uh-oh! <span aria-hidden="true">🫠</span></h1>
    </template>
    <p class="font-semibold text-muted" data-error>{{ reason }}</p>
    <template #footer>
      <div class="flex flex-wrap gap-2">
        <template v-if="user">
          <UButton to="/account" label="Back to Me" trailing-icon="i-lucide-arrow-right" />
          <UButton to="/notes" label="Open notes" color="neutral" variant="outline" />
        </template>
        <template v-else>
          <UButton to="/sign-in" label="Sign in" trailing-icon="i-lucide-arrow-right" />
          <UButton to="/" label="Home" color="neutral" variant="outline" />
        </template>
      </div>
    </template>
  </UCard>
</template>
