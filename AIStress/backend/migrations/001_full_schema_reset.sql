BEGIN;

DROP TABLE IF EXISTS
    results,
    executions,
    evaluations,
    tests,
    dimensions,
    configurations,
    models,
    organization_members,
    users,
    organizations
CASCADE;

COMMIT;
