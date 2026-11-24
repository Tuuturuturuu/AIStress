BEGIN;

DROP INDEX IF EXISTS uq_ollama_runtime_model_name;

ALTER TABLE models
    ADD COLUMN IF NOT EXISTS ollama_base_url VARCHAR(512),
    ADD COLUMN IF NOT EXISTS ollama_user_id INTEGER
        REFERENCES users(user_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS ollama_org_id INTEGER
        REFERENCES organizations(org_id) ON DELETE CASCADE;

ALTER TABLE models
    ADD CONSTRAINT ck_model_single_ollama_owner
    CHECK (ollama_user_id IS NULL OR ollama_org_id IS NULL);

CREATE INDEX IF NOT EXISTS ix_models_ollama_user_id
    ON models (ollama_user_id);

CREATE INDEX IF NOT EXISTS ix_models_ollama_org_id
    ON models (ollama_org_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_ollama_model_name
    ON models (ollama_user_id, runtime_model_name, ollama_base_url)
    WHERE runtime = 'OLLAMA'
      AND ollama_user_id IS NOT NULL
      AND runtime_model_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_ollama_model_name
    ON models (ollama_org_id, runtime_model_name, ollama_base_url)
    WHERE runtime = 'OLLAMA'
      AND ollama_org_id IS NOT NULL
      AND runtime_model_name IS NOT NULL;

UPDATE models
SET is_active = FALSE
WHERE runtime = 'OLLAMA'
  AND ollama_user_id IS NULL
  AND ollama_org_id IS NULL;

COMMIT;
