-- The app's own tables, next to better-auth's (0001).

-- Notes belong to a workspace (better-auth's `organization`); worker/notes.ts checks membership and role.
CREATE TABLE note (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
  authorId TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX note_organization ON note (organizationId, updatedAt);

-- Local development only (DEV_MAILBOX=1): a copy of every email, so links can be followed without a mailbox.
CREATE TABLE dev_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
