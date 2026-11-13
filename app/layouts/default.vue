<script setup lang="ts">
// The signed-in layout: a top bar (brand, team picker, day/night, you) and big tabs. On a phone the tabs sit at the bottom.
import type { DropdownMenuItem } from '@nuxt/ui';

const route = useRoute();
const { user, isAdmin, impersonating, refresh, signOut } = useAuth();
const { list, loaded, load, active, select } = useWorkspaces();
const lab = useLab();
const toast = useToast();

onMounted(() => { if (!loaded.value) void load(); });

const tabs = computed(() => [
  { label: 'Notes', emoji: '📝', to: '/notes', tint: 'bg-candy-yellow' },
  { label: 'Team', emoji: '🤝', to: '/workspace', tint: 'bg-candy-sky' },
  { label: 'Me', emoji: '😀', to: '/account', tint: 'bg-candy-pink' },
  ...(isAdmin.value ? [{ label: 'Admin', emoji: '🦸', to: '/admin', tint: 'bg-candy-lilac' }] : []),
]);
const isHere = (to: string) => route.path === to || route.path.startsWith(`${to}/`);

const teamItems = computed<DropdownMenuItem[][]>(() => [
  list.value.map((team) => ({
    label: team.name,
    type: 'checkbox' as const,
    checked: team.id === active.value?.id,
    onSelect: () => { void select(team.id); },
  })),
  [{ label: 'New team', icon: 'i-lucide-plus', to: '/workspace?new=1' }],
]);

const initials = computed(() => (user.value?.name ?? '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase());
const youItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label' as const, label: user.value?.name ?? '' }, { type: 'label' as const, label: user.value?.email ?? '', class: 'font-sans text-xs font-medium text-muted' }],
  ...(lab.value.dev ? [[{ label: 'Dev mailbox', icon: 'i-lucide-mail', to: '/dev/mailbox' }]] : []),
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: () => { void signOut(); } }],
]);

async function stopImpersonating() {
  const result = await authClient.admin.stopImpersonating();
  const error = problem(result);
  if (error) return toast.add({ title: 'Could not switch back', description: error, color: 'error' });
  await Promise.all([refresh(), load()]);
  await navigateTo('/admin');
}
</script>

<template>
  <div class="relative min-h-dvh">
    <FunShapes class="hidden xl:block" />

    <header class="relative">
      <div class="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-3">
        <NuxtLink to="/notes" aria-label="Auth Lab home" class="me-auto shrink-0 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <!-- On a phone only the face fits next to the team picker. -->
          <BrandMark word-class="hidden sm:inline" />
        </NuxtLink>
        <UDropdownMenu :items="teamItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="outline" trailing-icon="i-lucide-chevrons-up-down" class="max-w-44 min-w-0 sm:max-w-60" data-workspace-switcher>
            <span class="min-w-0 truncate" :title="active?.name">{{ active?.name ?? (list.length ? 'Pick a team' : 'No team yet') }}</span>
          </UButton>
        </UDropdownMenu>
        <ThemeSwitch />
        <UDropdownMenu :items="youItems" :content="{ align: 'end' }">
          <button type="button" class="pop-sm shrink-0 cursor-pointer rounded-full bg-candy-pink transition-transform hover:-translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="You" data-you>
            <UAvatar :src="user?.image ?? undefined" :text="initials" :alt="user?.name" size="lg" :ui="{ root: 'bg-transparent', fallback: 'font-display font-semibold text-night' }" />
          </button>
        </UDropdownMenu>
      </div>

      <nav class="mx-auto hidden w-full max-w-4xl gap-2 px-4 pb-3 sm:flex" aria-label="Main">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="group flex items-center gap-2.5 rounded-full px-4 py-1.5 font-display text-lg font-semibold transition-transform focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="isHere(tab.to) ? [tab.tint, 'pop-sm -rotate-2 text-night'] : 'border-2 border-transparent text-toned hover:-translate-y-0.5 hover:bg-elevated'"
          :aria-current="isHere(tab.to) ? 'page' : undefined"
        >
          <span class="group-hover:animate-wiggle" aria-hidden="true">{{ tab.emoji }}</span>{{ tab.label }}
        </NuxtLink>
      </nav>
    </header>

    <div v-if="impersonating" class="relative mx-auto w-full max-w-4xl px-4 pt-1" role="status">
      <div class="pop-sm flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-candy-orange px-4 py-2.5 text-night">
        <span class="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]"><span aria-hidden="true">🎭 </span>You are {{ user?.name }} right now.</span>
        <UButton label="Back to me" size="sm" color="neutral" variant="outline" @click="stopImpersonating" />
      </div>
    </div>

    <main class="relative mx-auto w-full max-w-4xl px-4 pt-3 pb-28 sm:pb-12"><slot /></main>

    <nav class="pop fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-full bg-default p-1.5 sm:hidden" aria-label="Main">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center rounded-full py-1 font-display text-xs font-semibold"
        :class="isHere(tab.to) ? [tab.tint, 'text-night'] : 'text-toned'"
        :aria-current="isHere(tab.to) ? 'page' : undefined"
      >
        <span class="text-xl leading-tight" aria-hidden="true">{{ tab.emoji }}</span>{{ tab.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
