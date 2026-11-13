<script setup lang="ts">
// The sign-in methods joined to this account: a password ("credential") and any social provider.
interface Linked { id: string; providerId: string; accountId: string; createdAt: string | Date }
const lab = useLab();
const toast = useToast();
// The list is loaded by the Account page (it also needs it for the password cards); null while loading.
const props = defineProps<{ accounts: Linked[] | null }>();
const emit = defineEmits<{ changed: [] }>();
const loading = computed(() => props.accounts === null);
const list = computed(() => props.accounts ?? []);
const labels: Record<string, string> = { credential: 'Email + password', github: 'GitHub' };

const hasGithub = computed(() => list.value.some((account) => account.providerId === 'github'));

// GitHub sends the browser back here: ?linked=github when it worked, ?error=<code> when it did not.
const route = useRoute();
const returned = !!(route.query.linked || route.query.error);
onMounted(() => {
  if (!returned) return;
  if (route.query.error) toast.add({ title: 'Could not link GitHub', description: redirectProblem(route.query.error), color: 'error' });
  else { toast.add({ title: 'GitHub linked!', color: 'success' }); useConfetti()(); }
  const { linked: _linked, error: _error, error_description: _description, ...rest } = route.query;
  void navigateTo({ path: route.path, query: rest }, { replace: true });
});

async function link() {
  const error = problem(await authClient.linkSocial({ provider: 'github', callbackURL: '/account?linked=github', errorCallbackURL: '/account' }));
  if (error) toast.add({ title: 'Could not link GitHub', description: error, color: 'error' });
}
async function unlink(account: Linked) {
  const error = problem(await authClient.unlinkAccount({ accountId: account.id }));
  if (error) toast.add({ title: 'Could not unlink', description: error, color: 'error' });
  emit('changed');
}
</script>

<template>
  <AccountSection emoji="🚪" title="Ways to sign in" tint="bg-candy-sky" :badge="loading ? null : list.length" :start-open="returned">
    <USkeleton v-if="loading" class="h-10 w-full" />
    <ul v-else class="space-y-2">
      <li v-for="account in list" :key="account.id" class="flex items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5" data-method>
        <UIcon :name="account.providerId === 'github' ? 'i-lucide-github' : 'i-lucide-lock'" class="size-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-display font-semibold text-highlighted">{{ labels[account.providerId] ?? account.providerId }}</p>
          <p class="text-xs font-semibold text-muted">Since {{ formatDate(account.createdAt) }}</p>
        </div>
        <UButton v-if="account.providerId !== 'credential' && list.length > 1" label="Unlink" size="sm" color="neutral" variant="ghost" @click="unlink(account)" />
      </li>
    </ul>
    <template v-if="!loading && !hasGithub">
      <UButton v-if="lab.github" label="Link GitHub" icon="i-lucide-github" color="neutral" variant="outline" @click="link" />
      <p v-else class="text-sm font-semibold text-muted">GitHub sign-in is off here.</p>
    </template>
  </AccountSection>
</template>
