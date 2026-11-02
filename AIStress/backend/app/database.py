import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://aistress:aistress_dev@localhost:5432/aistress",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def install_database_constraints() -> None:
    if engine.dialect.name != "postgresql":
        return

    manager_trigger_function = text(
        """
        CREATE OR REPLACE FUNCTION aistress_require_one_active_manager()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            checked_org_id INTEGER;
            manager_count INTEGER;
        BEGIN
            IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' THEN
                IF EXISTS (
                    SELECT 1
                    FROM configurations
                    WHERE user_id = OLD.user_id
                ) AND NEW.role <> 'MANAGER'
                   AND NEW.org_id IS NOT NULL THEN
                    RAISE EXCEPTION
                        'Reassign or delete configurations before assigning this user to an organization.';
                END IF;
            END IF;

            IF TG_TABLE_NAME = 'organizations' THEN
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                END IF;
                checked_org_id := NEW.org_id;
                IF EXISTS (
                    SELECT 1
                    FROM organizations
                    WHERE org_id = checked_org_id
                      AND is_active = TRUE
                ) THEN
                    SELECT COUNT(*) INTO manager_count
                    FROM users
                    WHERE org_id = checked_org_id
                      AND role = 'MANAGER'
                      AND is_active = TRUE;
                    IF manager_count < 1 THEN
                        RAISE EXCEPTION
                            'Each organization must have at least one active manager.';
                    END IF;
                END IF;
                RETURN NEW;
            END IF;

            IF TG_OP IN ('UPDATE', 'DELETE') THEN
                checked_org_id := OLD.org_id;
                IF checked_org_id IS NOT NULL
                   AND EXISTS (
                       SELECT 1
                       FROM organizations
                       WHERE org_id = checked_org_id
                         AND is_active = TRUE
                   ) THEN
                    SELECT COUNT(*) INTO manager_count
                    FROM users
                    WHERE org_id = checked_org_id
                      AND role = 'MANAGER'
                      AND is_active = TRUE;
                    IF manager_count < 1 THEN
                        RAISE EXCEPTION
                            'Each organization must retain at least one active manager.';
                    END IF;
                END IF;
            END IF;

            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                checked_org_id := NEW.org_id;
                IF checked_org_id IS NOT NULL
                   AND EXISTS (
                       SELECT 1
                       FROM organizations
                       WHERE org_id = checked_org_id
                         AND is_active = TRUE
                   ) THEN
                    SELECT COUNT(*) INTO manager_count
                    FROM users
                    WHERE org_id = checked_org_id
                      AND role = 'MANAGER'
                      AND is_active = TRUE;
                    IF manager_count < 1 THEN
                        RAISE EXCEPTION
                            'Each organization must have at least one active manager.';
                    END IF;
                END IF;
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    configuration_trigger_function = text(
        """
        CREATE OR REPLACE FUNCTION aistress_validate_configuration_owner()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            owner_org_id INTEGER;
            owner_role VARCHAR(7);
        BEGIN
            SELECT org_id, role INTO owner_org_id, owner_role
            FROM users
            WHERE user_id = NEW.user_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'The Configuration user does not exist.';
            END IF;
            IF owner_role <> 'MANAGER' AND owner_org_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'Only a manager or a user without an organization can have a Configuration.';
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )

    with engine.begin() as connection:
        connection.execute(manager_trigger_function)
        connection.execute(configuration_trigger_function)
        connection.execute(
            text("DROP TRIGGER IF EXISTS aistress_org_manager_guard ON organizations")
        )
        connection.execute(
            text("DROP TRIGGER IF EXISTS aistress_user_manager_guard ON users")
        )
        connection.execute(
            text("DROP TRIGGER IF EXISTS aistress_configuration_owner_guard ON configurations")
        )
        connection.execute(
            text(
                """
                CREATE CONSTRAINT TRIGGER aistress_org_manager_guard
                AFTER INSERT OR UPDATE ON organizations
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION aistress_require_one_active_manager()
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE CONSTRAINT TRIGGER aistress_user_manager_guard
                AFTER INSERT OR UPDATE OR DELETE ON users
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION aistress_require_one_active_manager()
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE CONSTRAINT TRIGGER aistress_configuration_owner_guard
                AFTER INSERT OR UPDATE ON configurations
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION aistress_validate_configuration_owner()
                """
            )
        )
