<script setup lang="ts">
// Members, roles and invitations of the active team (better-auth's organization plugin; "workspace" in the code).
import { ConfirmModal } from '#components';
import { roleLabels, roleNames, roleText, type RoleName } from '~~/shared/permissions';

interface Member { id: string; role: string; userId: string; user: { name: string; email: string } }
interface Invitation { id: string; email: string; role: string; status: string; expiresAt: string }

const route = useRoute();
const router = useRouter();
const { user, refresh } = useAuth();
const { list, loaded, load: loadWorkspaces, myInvitations: mine, loadInvitations, active, activeId, ensureActive, create } = useWorkspaces();
const toast = useToast();
const overlay = useOverlay();
const confetti = useConfetti();

const members = ref<Member[]>([]);
const invitations = ref<Invitation[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  const [full] = await Promise.all([
    activeId.value ? authClient.organization.getFullOrganization() : Promise.resolve({ data: null, error: null }),
    loadInvitations(),
  ]);
  members.value = ((full.data as { members?: Member[] } | null)?.members ?? []) as Member[];
  invitations.value = (((full.data as { invitations?: Invitation[] } | null)?.invitations ?? []) as Invitation[]).filter((invitation) => invitation.status === 'pending');
  loading.value = false;
}
onMounted(async () => {
  if (!loaded.value) await loadWorkspaces();
  await load();
});
watch(activeId, load);

const myRole = computed(() => members.value.find((member) => member.userId === user.value?.id)?.role ?? '');
const manages = computed(() => myRole.value === 'owner' || myRole.value === 'admin');
const isOwner = computed(() => myRole.value === 'owner');
const ownerCount = computed(() => members.value.filter((member) => member.role.split(',').map((name) => name.trim()).includes('owner')).length);
// The last owner cannot leave (the server refuses): someone else must become an owner first.
const mustHandOver = computed(() => isOwner.value && ownerCount.value < 2 && members.value.length > 1);
const mayRemove = (member: Member) => (member.userId === user.value?.id ? members.value.length > 1 && !mustHandOver.value : manages.value && (isOwner.value || member.role !== 'owner'));
// An admin manages members and viewers; only an owner can hand out or change the owner role.
const assignable = computed(() => roleNames.filter((name) => isOwner.value || name !== 'owner').map((name) => ({ label: roleText(name), value: name })));
// A face for each member: the first letter on a candy color picked from the name.
const faces = ['bg-candy-pink', 'bg-candy-sky', 'bg-candy-mint', 'bg-candy-yellow', 'bg-candy-lilac', 'bg-candy-orange'];
const face = (name: string) => faces[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % faces.length];

function report(title: string, error: string | null) {
  if (error) toast.add({ title, description: error, color: 'error' });
  return !error;
}

const invite = reactive({ email: '', role: 'member' as RoleName, busy: false });
async function sendInvite() {
  invite.busy = true;
  const result = await authClient.organization.inviteMember({ email: invite.email, role: invite.role });
  invite.busy = false;
  if (!report('Could not invite', problem(result))) return;
  toast.add({ title: 'Invite sent', description: `${invite.email} gets a link by mail.`, color: 'success' });
  invite.email = '';
  await load();
}
async function cancelInvite(invitation: Invitation) {
  if (report('Could not cancel', problem(await authClient.organization.cancelInvitation({ invitationId: invitation.id })))) {
    toast.add({ title: 'Invite cancelled', color: 'success' });
  }
  await load();
}
async function setRole(member: Member, role: RoleName) {
  if (report('Could not change the role', problem(await authClient.organization.updateMemberRole({ memberId: member.id, role })))) {
    toast.add({ title: 'Role changed', description: `${member.user.name} is now ${roleLabels[role].toLowerCase()}.`, color: 'success' });
  }
  await load();
}
async function removeMember(member: Member) {
  const self = member.userId === user.value?.id;
  const confirmed = await overlay.create(ConfirmModal).open({
    title: self ? `Leave ${active.value?.name}?` : `Remove ${member.user.name}?`,
    body: self ? 'You cannot see its notes any more.' : 'They cannot see this team’s notes any more.',
    confirmLabel: self ? 'Leave' : 'Remove',
    danger: true,
  }).result;
  if (!confirmed) return;
  const result = self
    ? await authClient.organization.leave({ organizationId: activeId.value! })
    : await authClient.organization.removeMember({ memberIdOrEmail: member.id });
  if (!report(self ? 'Could not leave' : 'Could not remove', problem(result))) return;
  toast.add(self
    ? { title: `You left ${active.value?.name}`, color: 'success' }
    : { title: `${member.user.name} is out`, color: 'success' });
  if (self) {
    await Promise.all([loadWorkspaces(), refresh()]);
    await ensureActive();
  }
  await load();
}
async function deleteWorkspace() {
  const confirmed = await overlay.create(ConfirmModal).open({ title: `Delete ${active.value?.name}?`, body: 'Deleting the team also deletes all its notes, for everyone.', confirmLabel: 'Delete team', danger: true }).result;
  if (!confirmed) return;
  if (!report('Could not delete the team', problem(await authClient.organization.delete({ organizationId: activeId.value! })))) return;
  await Promise.all([loadWorkspaces(), refresh()]);
  await ensureActive();
  await load();
}

const creator = reactive({ open: route.query.new === '1', name: '', busy: false, error: null as string | null });
watch(() => creator.name, () => { creator.error = null; });
watch(() => route.query.new, (value) => { if (value === '1') creator.open = true; });
watch(() => creator.open, (open) => { if (open) creator.error = null; if (!open && route.query.new) void router.replace({ query: {} }); });
async function createWorkspace() {
  creator.busy = true;
  creator.error = await create(creator.name);
  creator.busy = false;
  if (creator.error) return;
  confetti();
  creator.open = false;
  creator.name = '';
}
</script>

<template>
  <PageShell emoji="🤝" title="Team" :sub="active?.name" tint="bg-candy-sky">
    <template #actions>
      <UButton label="New team" icon="i-lucide-plus" color="neutral" variant="outline" data-new-workspace @click="creator.open = true" />
    </template>

    <UAlert
      v-for="invitation in mine"
      :key="invitation.id"
      color="info"
      variant="subtle"
      icon="i-lucide-mail"
      :title="`You’re invited to ${invitation.organizationName ?? 'a team'}!`"
      :actions="[{ label: 'Look', to: `/accept-invitation/${invitation.id}` }]"
    />

    <UAlert v-if="loaded && !list.length" color="info" variant="subtle" icon="i-lucide-info" title="No team yet" description="Make one to get going." :actions="[{ label: 'New team', onClick: () => { creator.open = true; } }]" />

    <template v-else-if="active">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold text-highlighted">Members</h2>
            <UBadge v-if="myRole" :label="`You: ${roleText(myRole)}`" color="primary" variant="subtle" class="ms-auto" />
          </div>
        </template>
        <USkeleton v-if="loading && !members.length" class="h-16 w-full" />
        <ul v-else class="space-y-3">
          <li v-for="member in members" :key="member.id" class="flex flex-wrap items-center gap-3" data-member>
            <span class="pop-sm grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold text-night" :class="face(member.user.name)" aria-hidden="true">{{ member.user.name.slice(0, 1).toUpperCase() }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-display font-semibold text-highlighted">{{ member.user.name }} <span v-if="member.userId === user?.id" class="font-sans text-sm font-semibold text-muted">(you)</span></p>
              <p class="truncate text-sm font-semibold text-muted">{{ member.user.email }}</p>
            </div>
            <USelect
              v-if="manages && member.userId !== user?.id && (isOwner || member.role !== 'owner')"
              :model-value="(member.role as RoleName)"
              :items="assignable"
              size="md"
              class="w-36"
              :aria-label="`Role of ${member.user.name}`"
              @update:model-value="(value: string) => setRole(member, value as RoleName)"
            />
            <UBadge v-else :label="roleText(member.role)" color="neutral" variant="subtle" size="lg" />
            <UButton
              v-if="mayRemove(member)"
              :label="member.userId === user?.id ? 'Leave' : 'Remove'"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="removeMember(member)"
            />
          </li>
        </ul>
        <template v-if="mustHandOver" #footer>
          <p class="text-sm font-semibold text-muted">You are the only owner. Make someone else an owner before you leave.</p>
        </template>
      </UCard>

      <UCard v-if="manages">
        <template #header>
          <h2 class="text-xl font-semibold text-highlighted">Invite a friend <span aria-hidden="true">💌</span></h2>
          <p class="font-semibold text-muted">They get a link by mail.</p>
        </template>
        <form class="flex flex-wrap gap-2" @submit.prevent="sendInvite">
          <UInput v-model="invite.email" type="email" placeholder="friend@example.com" required class="min-w-48 flex-1" aria-label="Email to invite" />
          <USelect v-model="invite.role" :items="assignable" class="w-36" aria-label="Role" />
          <UButton type="submit" label="Invite" icon="i-lucide-send" color="secondary" :loading="invite.busy" />
        </form>
        <ul v-if="invitations.length" class="mt-4 space-y-2">
          <li v-for="invitation in invitations" :key="invitation.id" class="flex flex-wrap items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5" data-invitation>
            <div class="min-w-0 flex-1">
              <p class="truncate font-display font-semibold text-highlighted">{{ invitation.email }}</p>
              <p class="text-xs font-semibold text-muted">{{ roleText(invitation.role) }} · until {{ formatDate(invitation.expiresAt) }}</p>
            </div>
            <UButton label="Cancel" size="sm" color="neutral" variant="ghost" @click="cancelInvite(invitation)" />
          </li>
        </ul>
      </UCard>

      <!-- What deleting does is said in the confirm dialog, not here. -->
      <div v-if="isOwner" class="flex justify-end">
        <UButton label="Delete this team" icon="i-lucide-trash-2" color="error" variant="outline" data-delete-team @click="deleteWorkspace" />
      </div>
    </template>

    <UAlert v-else-if="loaded" color="info" variant="subtle" icon="i-lucide-info" title="Pick a team" description="Use the menu at the top." />

    <UModal v-model:open="creator.open" title="New team" description="You will be its owner." :ui="{ footer: 'justify-end' }">
      <template #body>
        <form id="workspace-form" @submit.prevent="createWorkspace">
          <UFormField label="Name" name="name" :error="creator.error ?? undefined">
            <UInput v-model="creator.name" required maxlength="60" autofocus class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="creator.open = false" />
        <UButton type="submit" form="workspace-form" label="Create" :loading="creator.busy" />
      </template>
    </UModal>
  </PageShell>
</template>
