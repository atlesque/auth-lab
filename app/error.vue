<script setup lang="ts">
// Not-found and error page. It cannot use definePageMeta, so it wraps itself in the signed-out layout.
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const { user } = useAuth();
const notFound = computed(() => props.error.statusCode === 404);
const home = () => clearError({ redirect: '/' });
const go = (path: string) => clearError({ redirect: path });
const buddy = useBuddy();
onMounted(() => buddy.set('sad'));
</script>

<template>
  <NuxtLayout name="auth">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold text-highlighted">{{ notFound ? 'Oops! Nothing here' : 'Uh-oh! That broke' }} <span aria-hidden="true">{{ notFound ? '🙈' : '🫠' }}</span></h1>
      </template>
      <p class="font-semibold text-muted">{{ notFound ? 'This page ran away.' : 'Try again in a moment.' }}</p>
      <template #footer>
        <div class="flex flex-wrap gap-2">
          <template v-if="notFound">
            <UButton v-if="user" label="Open notes" trailing-icon="i-lucide-arrow-right" @click="go('/notes')" />
            <UButton v-else label="Sign in" trailing-icon="i-lucide-arrow-right" @click="go('/sign-in')" />
            <UButton v-if="user" label="Home" color="neutral" variant="outline" @click="home" />
          </template>
          <UButton v-else label="Start over" @click="home" />
        </div>
      </template>
    </UCard>
  </NuxtLayout>
</template>
