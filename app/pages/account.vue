<script setup lang="ts">
// Everything better-auth knows about the signed-in person: one fold-out part per feature, and the raw session near the end.
const { current, user, impersonating } = useAuth();
interface Linked { id: string; providerId: string; accountId: string; createdAt: string | Date }
// Loaded once here: the sign-in methods card lists them, the password, two-factor and delete cards need to know
// whether there is a password. null until the first answer arrives.
const accounts = ref<Linked[] | null>(null);
async function loadAccounts() {
  const result = await authClient.listAccounts();
  accounts.value = (result.data ?? []) as Linked[];
}
// Acting as someone else: those cards are hidden and the server refuses the actions anyway.
onMounted(() => { if (!impersonating.value) void loadAccounts(); });
const hasPassword = computed(() => accounts.value === null ? null : accounts.value.some((account) => account.providerId === 'credential'));
const sessions = useTemplateRef<{ load: () => Promise<void> }>('sessions');
// The token is the cookie's secret; show only its tail so a screenshot of this page gives nothing away.
const shown = computed(() => {
  if (!current.value) return 'null';
  const { session, user } = current.value;
  return JSON.stringify({ session: { ...session, token: `…${session.token.slice(-4)}` }, user }, null, 2);
});
</script>

<template>
  <PageShell emoji="😀" title="Me" :sub="user?.email" tint="bg-candy-pink">
    <UAlert v-if="impersonating" color="warning" variant="subtle" icon="i-lucide-venetian-mask" data-impersonation-notice
      :description="`You are ${user?.name || user?.email} right now. Some things are locked.`" />
    <div class="space-y-4">
      <AccountProfile />
      <template v-if="!impersonating">
        <AccountMethods :accounts="accounts" @changed="loadAccounts" />
        <AccountPassword :has-password="hasPassword" @changed="sessions?.load()" />
        <AccountTwoFactor :has-password="hasPassword" />
        <AccountPasskeys />
      </template>
      <AccountSessions ref="sessions" :read-only="impersonating" />
      <AccountApiKeys v-if="!impersonating" />
      <AccountSection emoji="🔍" title="Peek inside" tint="bg-candy-lilac">
        <p class="font-semibold text-muted">What the server knows about this sign-in.</p>
        <pre class="max-h-96 overflow-auto rounded-lg bg-elevated p-3.5 text-xs" data-session-json>{{ shown }}</pre>
      </AccountSection>
      <AccountDanger v-if="!impersonating" :has-password="hasPassword" />
    </div>
  </PageShell>
</template>
