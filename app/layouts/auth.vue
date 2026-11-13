<script setup lang="ts">
// The signed-out layout: the mascot, one centred column, the day/night button.
// A page picks the mascot's mood with `definePageMeta({ buddy })`; useBuddy() changes it for a moment.
import type { Mood } from '~~/ui/app/composables/useBuddy';

const route = useRoute();
const { override, set } = useBuddy();
const mood = computed<Mood>(() => override.value ?? (route.meta.buddy as Mood | undefined) ?? 'happy');
watch(() => route.path, () => set(null));
</script>

<template>
  <div class="relative flex min-h-dvh flex-col items-center px-4 py-8 sm:py-12">
    <FunShapes />
    <NuxtLink to="/" aria-label="Auth Lab home" class="relative mb-5 flex flex-col items-center gap-1 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <Buddy :mood="mood" :size="100" />
      <BrandMark :icon="false" />
    </NuxtLink>
    <main class="relative w-full max-w-md"><slot /></main>
    <div class="relative mt-8"><ThemeSwitch /></div>
  </div>
</template>
