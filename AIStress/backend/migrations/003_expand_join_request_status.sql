BEGIN;

ALTER TABLE organization_join_requests
    ALTER COLUMN status TYPE VARCHAR(9);

COMMIT;
