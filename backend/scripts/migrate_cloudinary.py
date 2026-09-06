import asyncio
from sqlalchemy import text
from app.database import engine

MIGRATION_COMMANDS = [
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS cloudinary_url VARCHAR(500)",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255)",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cloudinary_url VARCHAR(500)",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255)",
]

async def migrate():
    async with engine.begin() as conn:
        for cmd in MIGRATION_COMMANDS:
            await conn.execute(text(cmd.strip()))
    print("Cloudinary columns migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
