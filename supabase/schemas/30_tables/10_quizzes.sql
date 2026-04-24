CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  spec JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot of every prior spec when a quiz is edited. Enables stats to
-- attribute older responses to the exact spec the respondent saw, and lets
-- creators inspect past versions.
CREATE TABLE quiz_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  spec JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (quiz_id, version)
);

CREATE INDEX quiz_versions_quiz_id_idx ON quiz_versions(quiz_id);

CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  result_title TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX responses_quiz_id_version_idx ON responses(quiz_id, version);
