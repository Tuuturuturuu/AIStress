BEGIN;

ALTER TABLE models
    ADD COLUMN IF NOT EXISTS runtime VARCHAR(32) NOT NULL DEFAULT 'EXTERNAL',
    ADD COLUMN IF NOT EXISTS runtime_model_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS family VARCHAR(120),
    ADD COLUMN IF NOT EXISTS parameter_size VARCHAR(80),
    ADD COLUMN IF NOT EXISTS model_format VARCHAR(80),
    ADD COLUMN IF NOT EXISTS capabilities JSON NOT NULL DEFAULT '[]'::json,
    ADD COLUMN IF NOT EXISTS quantization VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ollama_runtime_model_name
    ON models (runtime_model_name)
    WHERE runtime = 'OLLAMA' AND runtime_model_name IS NOT NULL;

ALTER TABLE configurations
    ALTER COLUMN credentials DROP NOT NULL;

COMMIT;
