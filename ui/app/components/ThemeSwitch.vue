<script setup lang="ts">
// One round button: day or night. Until it is used, the device setting decides (public/boot.js).
const { set } = useTheme();
const toggle = () => set(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
</script>

<template>
  <UTooltip text="Day or night">
    <UButton color="neutral" variant="outline" square aria-label="Switch between day and night" class="group" @click="toggle">
      <UIcon name="i-lucide-sun" class="size-5 text-bright-orange transition-transform group-hover:rotate-45 dark:hidden" />
      <UIcon name="i-lucide-moon" class="hidden size-5 text-candy-yellow transition-transform group-hover:-rotate-12 dark:block" />
    </UButton>
  </UTooltip>
</template>
