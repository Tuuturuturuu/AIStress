BEGIN;

DROP INDEX IF EXISTS ix_organizations_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_organization_name
    ON organizations (name)
    WHERE is_active = TRUE;

COMMIT;
