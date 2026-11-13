<script setup lang="ts">
// The protected resource. The API decides what the role may do; the buttons follow the same rules (shared/permissions).
import { ConfirmModal } from '#components';
import { can, roleText } from '~~/shared/permissions';

interface Note { id: string; title: string; body: string; authorId: string; authorName: string | null; updatedAt: string }

const { user } = useAuth();
const { list, loaded, load: loadWorkspaces, myInvitations, loadInvitations, active, activeId, create: createWorkspace } = useWorkspaces();
const toast = useToast();
const overlay = useOverlay();
const confetti = useConfetti();

const notes = ref<Note[]>([]);
const role = ref('');
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  if (!activeId.value) { notes.value = []; loading.value = false; return; }
  loading.value = true;
  try {
    const data = await api<{ role: string; notes: Note[] }>('/notes');
    notes.value = data.notes;
    role.value = data.role;
    error.value = null;
  } catch (cause) {
    error.value = errorMessage(cause);
  }
  loading.value = false;
}
onMounted(async () => {
  if (!loaded.value) await loadWorkspaces();
  await Promise.all([load(), loadInvitations()]);
});
watch(activeId, load);

const mayCreate = computed(() => can(role.value, 'create'));
const mayEdit = (note: Note) => can(role.value, 'update') || (mayCreate.value && note.authorId === user.value?.id);
const mayDelete = (note: Note) => can(role.value, 'delete') || (mayCreate.value && note.authorId === user.value?.id);

// One short line about what the role cannot do, worked out from the same rules the API enforces.
const roleNote = computed(() => {
  if (!role.value || !activeId.value || (mayCreate.value && can(role.value, 'update') && can(role.value, 'delete'))) return '';
  return mayCreate.value ? 'You can change your own notes.' : 'You can look, but not write.';
});

// Each note is a sticky note: its color and tilt come from its id, so they stay the same between visits.
const papers = ['bg-candy-yellow', 'bg-candy-pink', 'bg-candy-sky', 'bg-candy-mint', 'bg-candy-lilac', 'bg-candy-orange'];
const tilts = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2', 'rotate-0'];
const seed = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const paper = (note: Note) => papers[seed(note.id) % papers.length];
const tilt = (note: Note) => tilts[seed(note.id) % tilts.length];

const editor = reactive({ open: false, id: null as string | null, title: '', body: '', busy: false });
function edit(note?: Note) {
  Object.assign(editor, { open: true, id: note?.id ?? null, title: note?.title ?? '', body: note?.body ?? '' });
}
async function save() {
  editor.busy = true;
  try {
    await api(editor.id ? `/notes/${editor.id}` : '/notes', { method: editor.id ? 'PATCH' : 'POST', body: { title: editor.title, body: editor.body } });
    if (!editor.id) confetti(30);
    editor.open = false;
    await load();
  } catch (cause) {
    toast.add({ title: 'Could not save', description: errorMessage(cause), color: 'error' });
  }
  editor.busy = false;
}
async function remove(note: Note) {
  const confirmed = await overlay.create(ConfirmModal).open({ title: 'Delete this note?', body: `“${note.title}” goes away for everyone.`, confirmLabel: 'Delete', danger: true }).result;
  if (!confirmed) return;
  try {
    await api(`/notes/${note.id}`, { method: 'DELETE' });
    await load();
  } catch (cause) {
    toast.add({ title: 'Could not delete', description: errorMessage(cause), color: 'error' });
  }
}

const firstName = ref('');
const firstError = ref<string | null>(null);
watch(firstName, () => { firstError.value = null; });
const creating = ref(false);
async function createFirst() {
  creating.value = true;
  firstError.value = await createWorkspace(firstName.value);
  creating.value = false;
  if (!firstError.value) confetti();
}
</script>

<template>
  <PageShell emoji="📝" title="Notes" :sub="active?.name" tint="bg-candy-yellow">
    <template #actions>
      <UBadge v-if="role" :label="roleText(role)" color="neutral" variant="subtle" size="lg" data-role />
      <UButton v-if="mayCreate" label="New note" icon="i-lucide-plus" data-new-note @click="edit()" />
    </template>

    <template v-if="loaded && !list.length">
      <UAlert
        v-for="invitation in myInvitations"
        :key="invitation.id"
        color="info"
        variant="subtle"
        icon="i-lucide-mail"
        :title="`You’re invited to ${invitation.organizationName ?? 'a team'}!`"
        :actions="[{ label: 'Look', to: `/accept-invitation/${invitation.id}` }]"
      />
    </template>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="The notes did not load" :description="error" :actions="[{ label: 'Try again', onClick: () => { void load(); } }]" />

    <UCard v-else-if="loaded && !list.length">
      <template #header>
        <h2 class="text-xl font-semibold text-highlighted">Start a team <span aria-hidden="true">🚀</span></h2>
        <p class="font-semibold text-muted">Notes live in a team.</p>
      </template>
      <form class="flex flex-wrap items-start gap-2" @submit.prevent="createFirst">
        <UFormField :error="firstError ?? undefined" class="min-w-40 flex-1">
          <UInput v-model="firstName" placeholder="Team name" required maxlength="60" class="w-full" aria-label="Team name" />
        </UFormField>
        <UButton type="submit" label="Create" :loading="creating" />
      </form>
    </UCard>

    <UAlert v-else-if="loaded && !activeId" color="info" variant="subtle" icon="i-lucide-info" title="Pick a team" description="Use the menu at the top." />

    <div v-else-if="loading && !notes.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="index in 3" :key="index" class="h-36 w-full" />
    </div>

    <template v-else>
      <p v-if="roleNote" class="font-semibold text-muted" data-role-note>{{ roleNote }}</p>

      <div v-if="!notes.length" class="rounded-[1.25rem] border-2 border-dashed border-ink/40 px-6 py-12 text-center">
        <p class="animate-bob text-5xl" aria-hidden="true">🌱</p>
        <p class="mt-2 font-display text-xl font-semibold text-highlighted">No notes yet</p>
        <UButton v-if="mayCreate" label="Write the first one" icon="i-lucide-plus" class="mt-4" @click="edit()" />
      </div>

      <ul v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="note in notes"
          :key="note.id"
          class="pop flex min-h-36 flex-col rounded-xl p-4 text-night sm:p-5 transition-transform duration-200 hover:z-10 hover:-translate-y-1 hover:rotate-0"
          :class="[paper(note), tilt(note)]"
          data-note
        >
          <p class="font-display text-lg leading-snug font-semibold break-words">{{ note.title }}</p>
          <p v-if="note.body" class="mt-1 text-sm font-semibold break-words whitespace-pre-wrap opacity-80">{{ note.body }}</p>
          <div class="mt-auto flex items-end gap-1 pt-3">
            <p class="min-w-0 flex-1 text-xs font-bold opacity-65 [overflow-wrap:anywhere]">{{ note.authorName ?? 'Someone who left' }} · {{ formatDate(note.updatedAt) }}</p>
            <button v-if="mayEdit(note)" type="button" class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-night bg-white/70 transition-transform hover:scale-110 hover:bg-white focus-visible:outline-3 focus-visible:outline-night" :aria-label="`Edit ${note.title}`" @click="edit(note)">
              <UIcon name="i-lucide-pencil" class="size-4" />
            </button>
            <button v-if="mayDelete(note)" type="button" class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-night bg-white/70 transition-transform hover:scale-110 hover:bg-white focus-visible:outline-3 focus-visible:outline-night" :aria-label="`Delete ${note.title}`" data-delete-note @click="remove(note)">
              <UIcon name="i-lucide-trash-2" class="size-4" />
            </button>
          </div>
        </li>
      </ul>
    </template>

    <UModal v-model:open="editor.open" :title="editor.id ? 'Edit note' : 'New note'" :ui="{ footer: 'justify-end' }">
      <template #body>
        <form id="note-form" class="space-y-4" @submit.prevent="save">
          <UFormField label="Title" name="title">
            <UInput v-model="editor.title" required maxlength="120" autofocus class="w-full" />
          </UFormField>
          <UFormField label="Text" name="body">
            <UTextarea v-model="editor.body" :rows="5" autoresize maxlength="5000" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="editor.open = false" />
        <UButton type="submit" form="note-form" label="Save" :loading="editor.busy" />
      </template>
    </UModal>
  </PageShell>
</template>
