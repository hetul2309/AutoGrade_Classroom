import asyncio
from sqlalchemy import text
from app.database import engine

MIGRATION_COMMANDS = [
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)",
    "ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT TRUE",
]

async def migrate():
    async with engine.begin() as conn:
        for cmd in MIGRATION_COMMANDS:
            await conn.execute(text(cmd.strip()))
    print("Profile migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
