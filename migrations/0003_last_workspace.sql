-- The workspace each person used last, so a new session opens on it (worker/auth.ts keeps it up to date).
CREATE TABLE user_workspace (
  userId TEXT PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  organizationId TEXT NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
  updatedAt TEXT NOT NULL
);
