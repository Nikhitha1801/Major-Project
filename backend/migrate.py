"""
Safely upgrades an existing attendify.db to match the current code's models,
WITHOUT deleting any existing data. Run this instead of seed.py whenever you
pull a code update -- seed.py wipes everything and rebuilds demo data; this
script only adds what's missing (new tables, new columns) and leaves
everything else exactly as it was.

Usage:
    python migrate.py

Safe to run any time, including on a database that's already fully up to
date (it'll just report there's nothing to do).
"""
from sqlalchemy import inspect

from app.database import SQLALCHEMY_DATABASE_URL, engine, Base
from app import models  # noqa: F401 -- import registers every model on Base


def _sqlite_type_for(column):
    try:
        return column.type.compile(dialect=engine.dialect)
    except Exception:
        return "TEXT"


def _default_sql_for(column):
    if column.default is not None and getattr(column.default, "is_scalar", False):
        val = column.default.arg
        if isinstance(val, bool):
            return "1" if val else "0"
        if isinstance(val, (int, float)):
            return str(val)
        if isinstance(val, str):
            return "'" + val.replace("'", "''") + "'"
    return "NULL"


def run():
    print(f"Database: {SQLALCHEMY_DATABASE_URL}")

    # Step 1: create any brand-new tables. Safe -- only affects tables that
    # don't exist yet, never touches existing ones.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    changes = []
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # brand new -- create_all() above already made it
            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_cols:
                    continue
                stmt = (
                    f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" '
                    f'{_sqlite_type_for(column)} DEFAULT {_default_sql_for(column)}'
                )
                print("Applying:", stmt)
                conn.exec_driver_sql(stmt)
                changes.append(f"{table.name}.{column.name}")
        conn.commit()

    if changes:
        print(f"\nDone -- added {len(changes)} missing column(s)/table(s). Existing data is untouched.")
    else:
        print("\nAlready up to date -- no changes needed.")


if __name__ == "__main__":
    run()
