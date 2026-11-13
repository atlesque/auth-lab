<script setup lang="ts">
// better-auth's admin plugin: list, promote, ban and impersonate users. The route guard only lets admins in, and the
// API checks the role again.
import type { DropdownMenuItem } from '@nuxt/ui';
import { ConfirmModal } from '#components';

interface AdminUser { id: string; name: string; email: string; role?: string | null; emailVerified: boolean; banned?: boolean | null; banReason?: string | null; createdAt: string | Date }

const { user: me, refresh } = useAuth();
const { load: loadWorkspaces } = useWorkspaces();
const toast = useToast();
const overlay = useOverlay();
const users = ref<AdminUser[]>([]);
const total = ref(0);
const search = ref('');
const loading = ref(true);
// A face for each person: the first letter on a candy color picked from the name.
const faces = ['bg-candy-pink', 'bg-candy-sky', 'bg-candy-mint', 'bg-candy-yellow', 'bg-candy-lilac', 'bg-candy-orange'];
const face = (name: string) => faces[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % faces.length];

async function load() {
  loading.value = true;
  const result = await authClient.admin.listUsers({
    query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc', ...(search.value ? { searchValue: search.value, searchField: 'email' as const, searchOperator: 'contains' as const } : {}) },
  });
  loading.value = false;
  const error = problem(result);
  if (error) return toast.add({ title: 'Could not load the list', description: error, color: 'error' });
  users.value = (result.data?.users ?? []) as AdminUser[];
  total.value = result.data?.total ?? users.value.length;
}
onMounted(load);

// Filter while typing, once the typing pauses; Enter still searches at once.
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 300);
});
onBeforeUnmount(() => clearTimeout(timer));
function searchNow() {
  clearTimeout(timer);
  void load();
}

async function act(title: string, result: Promise<{ error?: { message?: string } | null }>, done: string) {
  const error = problem(await result);
  if (error) toast.add({ title, description: error, color: 'error' });
  else toast.add({ title: done, color: 'success' });
  await load();
  return !error;
}

async function ban(user: AdminUser) {
  const confirmed = await overlay.create(ConfirmModal).open({ title: `Block ${user.name}?`, body: 'They are signed out and cannot get back in until you unblock them.', confirmLabel: 'Block', danger: true }).result;
  if (confirmed) await act('Could not block', authClient.admin.banUser({ userId: user.id, banReason: 'Blocked from the admin page' }), `${user.name} is blocked`);
}

async function signOutEverywhere(user: AdminUser) {
  const own = user.id === me.value?.id;
  const confirmed = await overlay.create(ConfirmModal).open({
    title: own ? 'Sign yourself out everywhere?' : `Sign ${user.name} out everywhere?`,
    body: own ? 'Every device is signed out. This one too.' : `${user.name} has to sign in again on every device.`,
    confirmLabel: 'Sign out everywhere',
    danger: true,
  }).result;
  if (!confirmed) return;
  const ok = await act('Could not sign them out', authClient.admin.revokeUserSessions({ userId: user.id }), `${user.name} is signed out everywhere`);
  // Our own session is gone too: the next request would bounce to sign-in anyway, so go there with a clean state.
  if (ok && own) await navigateTo('/sign-in');
}

async function impersonate(user: AdminUser) {
  const result = await authClient.admin.impersonateUser({ userId: user.id });
  const error = problem(result);
  if (error) return toast.add({ title: 'Could not act as them', description: error, color: 'error' });
  await Promise.all([refresh(), loadWorkspaces()]);
  await navigateTo('/notes');
}

const actions = (user: AdminUser): DropdownMenuItem[][] => [
  [
    { label: 'Act as them', icon: 'i-lucide-venetian-mask', disabled: user.id === me.value?.id || !!user.banned, onSelect: () => { void impersonate(user); } },
    user.role === 'admin'
      ? { label: 'Remove admin', icon: 'i-lucide-shield-off', disabled: user.id === me.value?.id, onSelect: () => { void act('Could not change the role', authClient.admin.setRole({ userId: user.id, role: 'user' }), `${user.name} is no longer an admin`); } }
      : { label: 'Make admin', icon: 'i-lucide-shield-check', onSelect: () => { void act('Could not change the role', authClient.admin.setRole({ userId: user.id, role: 'admin' }), `${user.name} is now an admin`); } },
    { label: 'Sign out everywhere', icon: 'i-lucide-log-out', onSelect: () => { void signOutEverywhere(user); } },
  ],
  [
    user.banned
      ? { label: 'Unblock', icon: 'i-lucide-user-check', onSelect: () => { void act('Could not unblock', authClient.admin.unbanUser({ userId: user.id }), `${user.name} can sign in again`); } }
      : { label: 'Block', icon: 'i-lucide-ban', color: 'error' as const, disabled: user.id === me.value?.id, onSelect: () => { void ban(user); } },
  ],
];
</script>

<template>
  <PageShell emoji="🦸" title="Admin" :sub="`${total} ${total === 1 ? 'person' : 'people'}`" tint="bg-candy-lilac">
    <template #actions>
      <form @submit.prevent="searchNow">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Find by email" size="md" class="w-48" aria-label="Find people by email" />
      </form>
    </template>

    <USkeleton v-if="loading && !users.length" class="h-24 w-full" />
    <p v-else-if="!users.length" class="font-semibold text-muted">Nobody found.</p>
    <ul v-else class="space-y-3">
      <li v-for="user in users" :key="user.id" class="pop-sm flex flex-wrap items-center gap-3 rounded-xl bg-default px-4 py-3" data-user>
        <span class="pop-sm grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold text-night" :class="face(user.name)" aria-hidden="true">{{ user.name.slice(0, 1).toUpperCase() }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-display font-semibold text-highlighted">{{ user.name }} <span v-if="user.id === me?.id" class="font-sans text-sm font-semibold text-muted">(you)</span></p>
          <p class="truncate text-sm font-semibold text-muted">{{ user.email }} · since {{ formatDate(user.createdAt) }}</p>
        </div>
        <UBadge v-if="user.banned" label="Blocked" color="error" variant="subtle" />
        <UBadge v-if="!user.emailVerified" label="Not confirmed" color="warning" variant="subtle" />
        <UBadge :label="user.role === 'admin' ? 'Admin' : 'User'" :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" />
        <UDropdownMenu :items="actions(user)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" color="neutral" variant="outline" size="sm" square :aria-label="`Actions for ${user.name}`" />
        </UDropdownMenu>
      </li>
    </ul>
  </PageShell>
</template>
