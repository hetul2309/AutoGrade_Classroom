import asyncio
from sqlalchemy import text
from app.database import engine

COMMANDS = [
    """
    CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        section VARCHAR(255) NOT NULL DEFAULT '',
        code VARCHAR(10) UNIQUE NOT NULL,
        color VARCHAR(100) NOT NULL DEFAULT 'linear-gradient(135deg, #4f46e5, #06b6d4)',
        teacher_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_classes_code ON classes(code)",
    "CREATE INDEX IF NOT EXISTS ix_classes_teacher_id ON classes(teacher_id)",
    """
    CREATE TABLE IF NOT EXISTS class_enrollments (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT uq_class_student UNIQUE (class_id, student_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_class_enrollments_class_id ON class_enrollments(class_id)",
    "CREATE INDEX IF NOT EXISTS ix_class_enrollments_student_id ON class_enrollments(student_id)",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500)",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)",
    "CREATE INDEX IF NOT EXISTS ix_assignments_class_id ON assignments(class_id)",
]

async def migrate():
    async with engine.begin() as conn:
        for cmd in COMMANDS:
            await conn.execute(text(cmd.strip()))

        # Check if default class exists
        res = await conn.execute(text("SELECT id FROM classes WHERE code = 'ML401A'"))
        existing_class = res.scalar_one_or_none()
        if not existing_class:
            res_admin = await conn.execute(text("SELECT id FROM students WHERE role = 'admin' LIMIT 1"))
            admin_id = res_admin.scalar_one_or_none()
            if admin_id:
                res_c = await conn.execute(
                    text("""
                        INSERT INTO classes (name, section, code, color, teacher_id)
                        VALUES ('CS401: Machine Learning Lab', 'Section A - Fall 2026', 'ML401A', 'linear-gradient(135deg, #4f46e5, #06b6d4)', :tid)
                        RETURNING id
                    """),
                    {"tid": admin_id}
                )
                new_cid = res_c.scalar_one()
                await conn.execute(
                    text("UPDATE assignments SET class_id = :cid WHERE class_id IS NULL"),
                    {"cid": new_cid}
                )
                await conn.execute(
                    text("""
                        INSERT INTO class_enrollments (class_id, student_id)
                        SELECT :cid, id FROM students WHERE role = 'student'
                        ON CONFLICT ON CONSTRAINT uq_class_student DO NOTHING
                    """),
                    {"cid": new_cid}
                )
                print(f"Created default class ML401A (id={new_cid}) and linked assignments and students!")

    print("Postgres migration for Google Classroom classes completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
