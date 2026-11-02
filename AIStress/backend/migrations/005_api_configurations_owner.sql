BEGIN;

DO $$
DECLARE
    duplicate_configuration RECORD;
BEGIN
    SELECT member.org_id, configuration.model_id, COUNT(*) AS configuration_count
    INTO duplicate_configuration
    FROM configurations configuration
    JOIN users member ON member.user_id = configuration.user_id
    WHERE member.org_id IS NOT NULL
      AND member.role = 'MANAGER'
    GROUP BY member.org_id, configuration.model_id
    HAVING COUNT(*) > 1
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Cannot migrate API configurations: organization %, model % has % manager-owned configurations. Resolve duplicates before retrying.',
            duplicate_configuration.org_id,
            duplicate_configuration.model_id,
            duplicate_configuration.configuration_count;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS aistress_configuration_owner_guard ON configurations;

ALTER TABLE configurations
    DROP CONSTRAINT configurations_pkey;

ALTER TABLE configurations
    ADD COLUMN configuration_id BIGINT;

CREATE SEQUENCE configurations_configuration_id_seq
    OWNED BY configurations.configuration_id;

ALTER TABLE configurations
    ALTER COLUMN configuration_id
    SET DEFAULT nextval('configurations_configuration_id_seq');

UPDATE configurations
SET configuration_id = nextval('configurations_configuration_id_seq');

ALTER TABLE configurations
    ALTER COLUMN configuration_id SET NOT NULL,
    ADD COLUMN organization_id INTEGER
        REFERENCES organizations (org_id) ON DELETE RESTRICT;

UPDATE configurations configuration
SET organization_id = member.org_id,
    user_id = NULL
FROM users member
WHERE member.user_id = configuration.user_id
  AND member.org_id IS NOT NULL
  AND member.role = 'MANAGER';

ALTER TABLE configurations
    ALTER COLUMN user_id DROP NOT NULL,
    ADD CONSTRAINT configurations_pkey PRIMARY KEY (configuration_id),
    ADD CONSTRAINT ck_configuration_has_one_owner
        CHECK (
            (user_id IS NOT NULL AND organization_id IS NULL)
            OR (user_id IS NULL AND organization_id IS NOT NULL)
        );

CREATE UNIQUE INDEX uq_user_model_configuration
    ON configurations (user_id, model_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX uq_organization_model_configuration
    ON configurations (organization_id, model_id)
    WHERE organization_id IS NOT NULL;

COMMIT;
