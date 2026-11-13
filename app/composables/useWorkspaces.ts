// The teams (better-auth organizations; "workspace" in the code) the person belongs to, and which one the session has active.
interface Workspace { id: string; name: string; slug: string }
export interface MyInvitation { id: string; organizationName?: string; role: string }

export function useWorkspaces() {
  const { current, refresh } = useAuth();
  const list = useState<Workspace[]>('workspaces', () => []);
  const loaded = useState('workspaces-loaded', () => false);
  // Invitations addressed to the signed-in person, so Notes and Workspace can both point at them.
  const myInvitations = useState<MyInvitation[]>('my-invitations', () => []);

  async function load() {
    const { data } = await authClient.organization.list();
    list.value = data ?? [];
    loaded.value = true;
  }

  async function loadInvitations() {
    const { data } = await authClient.organization.listUserInvitations();
    myInvitations.value = ((data ?? []) as (MyInvitation & { status: string })[]).filter((invitation) => invitation.status === 'pending');
  }

  const activeId = computed(() => current.value?.session.activeOrganizationId ?? null);
  const active = computed(() => list.value.find((workspace) => workspace.id === activeId.value) ?? null);

  async function select(organizationId: string) {
    const result = await authClient.organization.setActive({ organizationId });
    await refresh();
    return problem(result);
  }

  // After deleting or leaving the current workspace, open another one when there is one, so nobody lands on "Choose a workspace".
  // Call after load() and refresh().
  async function ensureActive() {
    if (!list.value.length || list.value.some((workspace) => workspace.id === activeId.value)) return;
    await select(list.value[0]!.id);
  }

  // Returns a message for the name field, or null when the name is fine. Names are compared trimmed and case-insensitive.
  function nameProblem(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return 'Give it a name.';
    if (list.value.some((workspace) => workspace.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return `You already have a team called ${trimmed}.`;
    }
    return null;
  }

  async function create(rawName: string) {
    const name = rawName.trim();
    const invalid = nameProblem(name);
    if (invalid) return invalid;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await authClient.organization.create({ name, slug });
    if (result.error) return problem(result);
    await Promise.all([load(), refresh()]);
    return null;
  }

  return { list, loaded, load, myInvitations, loadInvitations, activeId, active, select, ensureActive, nameProblem, create };
}
