-- Tabela de tarefas / agenda
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id   UUID        REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_nome TEXT,
  title        TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'tarefa', -- followup | call | proposta | tarefa
  notes        TEXT,
  due_date     DATE        NOT NULL,
  due_time     TIME,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx   ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx  ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_empresa_id_idx ON tasks(empresa_id);
