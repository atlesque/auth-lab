<script setup lang="ts">
definePageMeta({ layout: 'auth' });
const route = useRoute();
const { user } = useAuth();
// The account page sends people here after deleting their account.
const deleted = ref(route.query.deleted === '1');
// What the lab lets you try: one tile per better-auth feature.
const tricks = [
  { emoji: '🔒', label: 'Password', tint: 'bg-candy-yellow' },
  { emoji: '✨', label: 'Magic link', tint: 'bg-candy-pink' },
  { emoji: '🗝️', label: 'Passkey', tint: 'bg-candy-sky' },
  { emoji: '🐙', label: 'GitHub', tint: 'bg-candy-lilac' },
  { emoji: '🔢', label: '2-step code', tint: 'bg-candy-mint' },
  { emoji: '🤝', label: 'Teams', tint: 'bg-candy-orange' },
  { emoji: '📱', label: 'Devices', tint: 'bg-candy-pink' },
  { emoji: '🤖', label: 'API keys', tint: 'bg-candy-yellow' },
  { emoji: '🦸', label: 'Admin', tint: 'bg-candy-sky' },
];
</script>

<template>
  <div class="space-y-7 text-center">
    <UAlert v-if="deleted" color="success" variant="subtle" icon="i-lucide-circle-check" description="Your account is gone. Bye!" close class="text-start" data-notice @update:open="deleted = false" />
    <div class="space-y-2">
      <h1 class="text-5xl font-bold text-highlighted">Hi there! <span class="inline-block origin-[70%_70%] animate-wave" aria-hidden="true">👋</span></h1>
      <p class="text-lg font-semibold text-muted">A tiny notes app for trying sign-in tricks.</p>
    </div>
    <div class="flex flex-wrap justify-center gap-3">
      <UButton v-if="user" to="/notes" label="Open notes" trailing-icon="i-lucide-arrow-right" size="xl" />
      <template v-else>
        <UButton to="/sign-in" label="Sign in" size="xl" />
        <UButton to="/sign-up" label="Join" size="xl" color="secondary" />
      </template>
    </div>
    <ul class="grid grid-cols-3 gap-3">
      <li
        v-for="(trick, index) in tricks"
        :key="trick.label"
        class="pop-sm group rounded-xl px-2 py-4 text-night transition-transform hover:-translate-y-1"
        :class="[trick.tint, index % 2 ? 'rotate-1 hover:rotate-0' : '-rotate-1 hover:rotate-0']"
      >
        <span class="block text-3xl group-hover:animate-wiggle" aria-hidden="true">{{ trick.emoji }}</span>
        <span class="font-display text-sm font-semibold">{{ trick.label }}</span>
      </li>
    </ul>
  </div>
</template>
