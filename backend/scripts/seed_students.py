import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Student, UserRole, Class, ClassEnrollment
from app.auth import hash_password

STUDENTS_DATA = [
    {"id": 202301002, "name": "BHUMSAR BORO", "email": "202301002@dau.ac.in", "pass": "202301002"},
    {"id": 202301014, "name": "UBHADIA DAKSH RAJENDRABHAI", "email": "202301014@dau.ac.in", "pass": "202301014"},
    {"id": 202301066, "name": "VAGHERA MAHEK SHAILESH", "email": "202301066@dau.ac.in", "pass": "202301066"},
    {"id": 202301077, "name": "BHENSADADIA HAPPYBEN CHIMANBHAI", "email": "202301077@dau.ac.in", "pass": "202301077"},
    {"id": 202301079, "name": "KUSHAL BHUPTANI", "email": "202301079@dau.ac.in", "pass": "202301079"},
    {"id": 202301090, "name": "PATEL JHIL PARESHKUMAR", "email": "202301090@dau.ac.in", "pass": "202301090"},
    {"id": 202301122, "name": "DALSANIYA KOSHA RAJESHBHAI", "email": "202301122@dau.ac.in", "pass": "202301122"},
    {"id": 202301125, "name": "RAJ SHUBH KIRANBHAI", "email": "202301125@dau.ac.in", "pass": "202301125"},
    {"id": 202301131, "name": "TANMAY SARDA", "email": "202301131@dau.ac.in", "pass": "202301131"},
    {"id": 202301151, "name": "BHUVA HEET VIJAYBHAI", "email": "202301151@dau.ac.in", "pass": "202301151"},
]

async def seed_students():
    async with AsyncSessionLocal() as session:
        # Get all existing classes to enroll students into
        classes_res = await session.execute(select(Class))
        all_classes = classes_res.scalars().all()

        created_count = 0
        updated_count = 0

        for item in STUDENTS_DATA:
            # Check if student exists by email
            stmt = select(Student).where(Student.email == item["email"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            hashed_pw = hash_password(item["pass"])

            if existing:
                existing.name = item["name"]
                existing.hashed_password = hashed_pw
                updated_count += 1
                student_id = existing.id
                print(f"Updated student: {item['name']} ({item['email']})")
            else:
                new_student = Student(
                    id=item["id"],
                    name=item["name"],
                    email=item["email"],
                    hashed_password=hashed_pw,
                    role=UserRole.student,
                )
                session.add(new_student)
                await session.flush()
                student_id = new_student.id
                created_count += 1
                print(f"Created student: {item['name']} ({item['email']}) with ID {student_id}")

            # Enroll in all available classes
            for c in all_classes:
                enr_stmt = select(ClassEnrollment).where(
                    ClassEnrollment.class_id == c.id,
                    ClassEnrollment.student_id == student_id,
                )
                enr_res = await session.execute(enr_stmt)
                if not enr_res.scalar_one_or_none():
                    enrollment = ClassEnrollment(class_id=c.id, student_id=student_id)
                    session.add(enrollment)

        await session.commit()
        print(f"\nCompleted! Created: {created_count}, Updated: {updated_count} students.")
        print(f"Enrolled in {len(all_classes)} class(es).")

if __name__ == "__main__":
    asyncio.run(seed_students())
