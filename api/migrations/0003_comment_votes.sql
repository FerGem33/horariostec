CREATE TABLE IF NOT EXISTS comment_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('evaluation', 'legacy')),
  comment_id INTEGER NOT NULL,
  voter_key TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('like', 'dislike')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, comment_id, voter_key)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment
  ON comment_votes(source, comment_id, vote);
