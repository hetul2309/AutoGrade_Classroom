import asyncio
from app.database import AsyncSessionLocal
from app.models import Student, UserRole
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(Student).where(Student.email == 'admin@mlcourse.edu'))).scalar_one_or_none()
        if user:
            user.role = UserRole.student
            user.name = "Prof. Miller (Faculty)"
            await session.commit()
            print("Successfully updated admin@mlcourse.edu to role=student (Teacher/User side)!")
        else:
            print("User admin@mlcourse.edu not found in database.")

if __name__ == "__main__":
    asyncio.run(main())
