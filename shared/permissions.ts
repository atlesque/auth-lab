// Workspace roles and what each may do with notes. Used by the organization plugin on the server and the client, and by
// the notes API (worker/notes.ts), so the buttons shown and the checks enforced come from one place.
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access';

// `update` and `delete` mean "any note in the workspace"; whoever may `create` may always change their own notes.
export const statement = { ...defaultStatements, note: ['create', 'update', 'delete'] } as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, note: ['create', 'update', 'delete'] }),
  admin: ac.newRole({ ...adminAc.statements, note: ['create', 'update', 'delete'] }),
  member: ac.newRole({ ...memberAc.statements, note: ['create'] }),
  // Read-only: a custom role on top of the plugin's three.
  viewer: ac.newRole({ note: [] }),
};

export type RoleName = keyof typeof roles;
export const roleNames = Object.keys(roles) as RoleName[];
export const roleLabels: Record<RoleName, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };
export const roleEmoji: Record<RoleName, string> = { owner: '👑', admin: '⭐', member: '✏️', viewer: '👀' };
/** "👑 Owner": the emoji, a wide space (emoji crowd an ordinary one) and the label. Unknown roles show as they are. */
export const roleText = (role: string) => (role in roleLabels ? `${roleEmoji[role as RoleName]}\u2002${roleLabels[role as RoleName]}` : role);

type NoteAction = (typeof statement.note)[number];

// A member row can hold several roles as "a,b".
export function can(role: string | null | undefined, action: NoteAction): boolean {
  return (role ?? '').split(',').some((name) => {
    const found = roles[name.trim() as RoleName];
    return !!found && found.authorize({ note: [action] }).success;
  });
}
