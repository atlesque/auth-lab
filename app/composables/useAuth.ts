// The signed-in session, loaded once by the route middleware and refreshed after anything that changes it
// (sign-in, sign-out, switching workspace, impersonation, profile edits).
export function useAuth() {
  const current = useState<SessionData | null>('auth-session', () => null);
  const ready = useState('auth-ready', () => false);

  async function refresh() {
    const { data } = await authClient.getSession();
    current.value = data ?? null;
    ready.value = true;
    return current.value;
  }

  async function signOut() {
    await authClient.signOut();
    current.value = null;
    useState('workspaces-loaded').value = false;
    await navigateTo('/sign-in');
  }

  const user = computed(() => current.value?.user ?? null);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const impersonating = computed(() => !!current.value?.session.impersonatedBy);
  return { current, ready, user, isAdmin, impersonating, refresh, signOut };
}
