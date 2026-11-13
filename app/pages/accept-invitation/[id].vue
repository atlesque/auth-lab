<script setup lang="ts">
// The link in an invitation email. The route guard sends signed-out visitors to sign in (or sign up) and back here.
import { roleText } from '~~/shared/permissions';

definePageMeta({ layout: 'auth', buddy: 'party' });
const route = useRoute();
const { user, refresh } = useAuth();
const { load } = useWorkspaces();
const confetti = useConfetti();
const id = String(route.params.id);

interface Invitation { organizationName: string; inviterEmail: string; role: string; email: string; status: string; organizationId: string }
const invitation = ref<Invitation | null>(null);
// What is wrong with the link, if anything. 'closed' covers every invitation that is not pending (better-auth answers
// 400 "Invitation not found!" without a code for accepted, declined, cancelled, expired and made-up ids alike).
const failure = ref<{ kind: 'joined' | 'closed' | 'address' | 'other'; title: string; description?: string } | null>(null);
const busy = ref<'accept' | 'decline' | null>(null);
const rememberKey = `auth-lab:invitation:${id}`;

// An invitation id cannot be mapped to a workspace once it is closed, so the name seen while it was pending is kept in
// this browser. If that workspace is now one of yours, the invitation was accepted.
const remembered = () => { try { return localStorage.getItem(rememberKey); } catch { return null; } };

async function explain(result: { error?: { message?: string; statusText?: string; status?: number; code?: string } | null }) {
  const code = result.error?.code;
  if (code === 'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION') {
    failure.value = { kind: 'address', title: 'This invite is for another email', description: `You are ${user.value?.email}. Sign out and open the link again with the invited email.` };
  } else if ((result.error?.status === 400 && !code) || code === 'INVITATION_NOT_FOUND') {
    const name = remembered();
    const mine = await authClient.organization.list();
    const joined = name && (mine.data ?? []).some(org => org.name === name);
    if (joined) failure.value = { kind: 'joined', title: `You are already in ${name}` };
    else if (mine.data?.length) failure.value = { kind: 'closed', title: 'This invite is closed', description: 'It was used, cancelled or is too old. If you joined, the team is in the menu at the top.' };
    else failure.value = { kind: 'closed', title: 'This invite is closed', description: 'Ask for a new one.' };
  } else {
    failure.value = { kind: 'other', title: problem(result, 'This invite could not be opened.') ?? 'This invite could not be opened.' };
  }
}

onMounted(async () => {
  const result = await authClient.organization.getInvitation({ query: { id } });
  if (result.error) { await explain(result); return; }
  invitation.value = (result.data as Invitation | null) ?? null;
  if (invitation.value) { try { localStorage.setItem(rememberKey, invitation.value.organizationName); } catch { /* storage blocked */ } }
});

async function accept() {
  busy.value = 'accept';
  const result = await authClient.organization.acceptInvitation({ invitationId: id });
  if (result.error) { busy.value = null; await explain(result); return; }
  if (invitation.value) await authClient.organization.setActive({ organizationId: invitation.value.organizationId });
  confetti();
  await Promise.all([refresh(), load()]);
  await navigateTo('/notes');
}

async function decline() {
  busy.value = 'decline';
  const result = await authClient.organization.rejectInvitation({ invitationId: id });
  busy.value = null;
  if (result.error) { await explain(result); return; }
  await navigateTo('/notes');
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold text-highlighted">You’re invited! <span aria-hidden="true">🎉</span></h1>
    </template>
    <div class="space-y-4">
      <template v-if="failure?.kind === 'joined'">
        <UAlert color="success" variant="subtle" icon="i-lucide-circle-check" :title="failure.title" data-notice />
        <UButton to="/notes" label="Open notes" trailing-icon="i-lucide-arrow-right" />
      </template>
      <UAlert v-else-if="failure" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="failure.title" :description="failure.description" data-error />
      <template v-else-if="invitation">
        <p>
          <strong class="break-all text-highlighted">{{ invitation.inviterEmail }}</strong> wants you in
          <strong class="text-highlighted [overflow-wrap:anywhere]">{{ invitation.organizationName }}</strong> as <UBadge :label="roleText(invitation.role)" color="primary" variant="subtle" />.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton label="Join" size="xl" color="secondary" :loading="busy === 'accept'" :disabled="!!busy" data-accept @click="accept" />
          <UButton label="No thanks" size="xl" color="neutral" variant="outline" :loading="busy === 'decline'" :disabled="!!busy" @click="decline" />
        </div>
      </template>
      <USkeleton v-else class="h-16 w-full" />
    </div>
    <template #footer>
      <NuxtLink to="/notes" class="font-semibold text-primary underline underline-offset-2">Open notes</NuxtLink>
    </template>
  </UCard>
</template>
