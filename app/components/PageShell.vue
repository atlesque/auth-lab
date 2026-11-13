<script setup lang="ts">
// The top of a signed-in page: an emoji tile, a big title, a small line under it, and room for buttons.
defineProps<{ emoji: string; title: string; sub?: string | null; tint?: string }>();
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-center gap-3">
      <span class="pop-sm grid size-12 shrink-0 -rotate-3 place-items-center rounded-lg text-2xl" :class="tint ?? 'bg-candy-yellow'" aria-hidden="true">{{ emoji }}</span>
      <div class="min-w-32 flex-1">
        <h1 class="truncate text-3xl leading-tight font-bold text-highlighted">{{ title }}</h1>
        <p v-if="sub" class="truncate text-sm font-semibold text-muted" :title="sub">{{ sub }}</p>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
    </header>
    <slot />
  </div>
</template>
