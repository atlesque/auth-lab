<script setup lang="ts">
// One fold-out part of the "Me" page: a colorful row that opens when tapped. The content stays mounted while closed,
// so each part can load its data (and show its badge) before anyone opens it.
const props = defineProps<{ emoji: string; title: string; tint: string; badge?: string | number | null; badgeColor?: 'success' | 'neutral' | 'warning' | 'error'; startOpen?: boolean }>();
const open = ref(!!props.startOpen);
const id = useId();
</script>

<template>
  <section class="pop overflow-hidden rounded-[1.25rem] bg-default">
    <h2>
      <button type="button" class="group flex w-full cursor-pointer items-center gap-3 p-3.5 text-start focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-primary" :aria-expanded="open" :aria-controls="id" @click="open = !open">
        <span class="pop-sm grid size-11 shrink-0 place-items-center rounded-lg text-xl transition-transform group-hover:-rotate-6" :class="tint" aria-hidden="true">{{ emoji }}</span>
        <span class="min-w-0 flex-1 font-display text-lg font-semibold text-highlighted">{{ title }}</span>
        <UBadge v-if="badge !== undefined && badge !== null && badge !== ''" :label="String(badge)" :color="badgeColor ?? 'neutral'" variant="subtle" />
        <UIcon name="i-lucide-chevron-down" class="size-5 shrink-0 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
      </button>
    </h2>
    <div v-show="open" :id="id" class="space-y-4 px-4 pt-1 pb-5 sm:px-5"><slot /></div>
  </section>
</template>
