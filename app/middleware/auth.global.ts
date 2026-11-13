// Every page except the sign-in flow needs a session; /admin also needs the admin role.
// The guard also owns the "you arrived here because…" messages: email confirmed, signed out elsewhere, admins only.
const open = new Set(['/', '/sign-in', '/sign-up', '/check-email', '/forgot-password', '/reset-password', '/two-factor', '/auth-error']);

// Remembers that this browser had a session, so a later visit that finds none can say why the sign-in page appeared.
// localStorage rather than sessionStorage: people come back in a new tab. Storage can be blocked, so access is wrapped.
const HAD_SESSION = 'auth-lab:had-session';
const store = {
  has: (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } },
  set: (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* storage blocked */ } },
  clear: (key: string) => { try { localStorage.removeItem(key); } catch { /* storage blocked */ } },
};

export default defineNuxtRouteMiddleware(async (to) => {
  const { current, ready, refresh } = useAuth();
  const toast = useToast();
  // Only a full page load asks the server; a client-side navigation trusts the state it has.
  const fullLoad = !ready.value;
  if (fullLoad) await refresh();

  // Arriving from a confirmation link: say so once and take the marker (and better-auth's ?error=) out of the address.
  if (to.query.confirmed !== undefined) {
    const { confirmed: _confirmed, error, ...rest } = to.query;
    if (error) {
      // A link that expired: better-auth redirects here with ?error=. Without a session the sign-in page explains it.
      if (!current.value) return navigateTo({ path: '/sign-in', query: { error: String(error), confirmation: '1' } });
      if (import.meta.client) toast.add({ title: 'That link did not work', description: redirectProblem(error, { confirmation: true }), color: 'error' });
    } else if (import.meta.client) {
      if (current.value) { toast.add({ title: 'Email confirmed. You are in!', color: 'success' }); useConfetti()(); }
      // A link that was already used confirms nothing new and does not sign anyone in.
      else toast.add({ title: 'Email confirmed. Now sign in.', color: 'success' });
    }
    return navigateTo({ path: to.path, query: rest, hash: to.hash }, { replace: true });
  }

  const guestPage = open.has(to.path) || to.path.startsWith('/dev/');
  if (!current.value) {
    if (import.meta.client) {
      if (fullLoad && store.has(HAD_SESSION) && !guestPage) {
        // This browser had a session and the server no longer knows it: signed out elsewhere, password changed, banned.
        store.clear(HAD_SESSION);
        return navigateTo({ path: '/sign-in', query: { redirect: to.fullPath, ended: '1' } });
      }
      // A client-side navigation without a session is an explicit sign-out (signOut() navigates after clearing state).
      if (!fullLoad) store.clear(HAD_SESSION);
    }
    return guestPage ? undefined : navigateTo({ path: '/sign-in', query: { redirect: to.fullPath } });
  }

  if (import.meta.client) store.set(HAD_SESSION);
  if (to.path === '/sign-in' || to.path === '/sign-up' || to.path === '/two-factor') return navigateTo(safePath(to.query.redirect));
  if (to.path === '/admin' && current.value.user.role !== 'admin') {
    if (import.meta.client) toast.add({ title: 'Admins only.', color: 'neutral' });
    return navigateTo('/notes');
  }
});
