<script setup lang="ts">
// The word mark: the mascot's face and "Auth Lab" in candy letters.
withDefaults(defineProps<{ icon?: boolean; word?: boolean; wordClass?: string; size?: number }>(), { icon: true, word: true, size: 36 });
const letters = [
  ['A', 'text-bright-pink'], ['u', 'text-bright-orange'], ['t', 'text-bright-yellow'], ['h', 'text-bright-green'],
  ['L', 'ms-[0.25em] text-bright-blue'], ['a', 'text-bright-purple'], ['b', 'text-bright-pink'],
] as const;
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <img v-if="icon" src="/favicon.svg" :width="size" :height="size" alt="" class="shrink-0">
    <span v-if="word" class="font-display text-2xl leading-none font-bold tracking-tight" :class="wordClass" aria-hidden="true">
      <span v-for="([letter, color], index) in letters" :key="index" :class="color">{{ letter }}</span>
    </span>
  </span>
</template>
