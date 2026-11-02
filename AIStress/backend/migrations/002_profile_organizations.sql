BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM organizations organization
        LEFT JOIN users member
            ON member.org_id = organization.org_id
           AND member.role = 'MANAGER'
           AND member.is_active = TRUE
        GROUP BY organization.org_id
        HAVING COUNT(member.user_id) = 0
    ) THEN
        RAISE EXCEPTION
            'No se puede migrar: hay organizaciones sin manager activo. Asigna un manager antes de continuar.';
    END IF;
END;
$$;

UPDATE users
SET org_id = NULL
WHERE role = 'ADMIN'
  AND org_id IS NOT NULL;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255);

ALTER TABLE organizations
    ALTER COLUMN description DROP DEFAULT,
    ALTER COLUMN address DROP DEFAULT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_admin_has_no_organization'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT ck_admin_has_no_organization
            CHECK (role <> 'ADMIN' OR org_id IS NULL);
    END IF;
END;
$$;

DROP INDEX IF EXISTS uq_users_manager_per_org;

CREATE TABLE IF NOT EXISTS organization_join_requests (
    request_id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL
        REFERENCES organizations (org_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL
        REFERENCES users (user_id) ON DELETE CASCADE,
    status VARCHAR(9) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMPTZ,
    decided_by_user_id INTEGER
        REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_organization_join_requests_organization_id
    ON organization_join_requests (organization_id);
CREATE INDEX IF NOT EXISTS ix_organization_join_requests_user_id
    ON organization_join_requests (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_organization_join_request
    ON organization_join_requests (organization_id, user_id)
    WHERE status = 'PENDING';

COMMIT;
