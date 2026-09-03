import os
import shutil
from pathlib import Path
import httpx
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Student, Class, Assignment, ClassEnrollment

BASE = "http://127.0.0.1:8000"
SAMPLE_DIR = Path("sample_assignments")

# 10 Seeded Students and their corresponding source sample files
MAPPING = [
    {"student_id": 202301002, "src_file": "202301002_lab1.ipynb"},
    {"student_id": 202301014, "src_file": "202301048_lab1.ipynb"},
    {"student_id": 202301066, "src_file": "202301136_lab1.ipynb"},
    {"student_id": 202301077, "src_file": "202301077_lab1.ipynb"},
    {"student_id": 202301079, "src_file": "202301079_lab1.ipynb"},
    {"student_id": 202301090, "src_file": "202301090_lab_1.ipynb"},
    {"student_id": 202301122, "src_file": "202301122_lab1.ipynb"},
    {"student_id": 202301125, "src_file": "202301266_lab1.ipynb"},
    {"student_id": 202301131, "src_file": "202301131_lab1.ipynb"},
    {"student_id": 202301151, "src_file": "202301278_lab1.ipynb"},
]

async def setup_and_upload():
    print("=" * 70)
    print("  UPLOADING 10 STUDENT SUBMISSIONS TO 'Demo1: Machine Learning'")
    print("=" * 70)

    # 1. Step 1: Rename files in sample_assignments to studentid_demolab1.ipynb
    print("\n[Step 1] Renaming sample assignment files...")
    renamed_files = []
    for item in MAPPING:
        src = SAMPLE_DIR / item["src_file"]
        dest = SAMPLE_DIR / f"{item['student_id']}_demolab1.ipynb"
        if src.exists() and src != dest:
            shutil.move(src, dest)
            print(f"  Renamed: {src.name} -> {dest.name}")
        elif dest.exists():
            print(f"  Target already exists: {dest.name}")
        else:
            print(f"  Warning: Source file {src} not found!")
        renamed_files.append({"student_id": item["student_id"], "filepath": dest})

    # 2. Step 2: Find Class 'Demo1: Machine Learning' and its Assignment
    print("\n[Step 2] Finding 'Demo1: Machine Learning' class and assignment...")
    assignment_id = None
    class_id = None
    async with AsyncSessionLocal() as session:
        c_res = await session.execute(select(Class).where(Class.name.ilike("%Demo1%")))
        class_obj = c_res.scalars().first()
        if not class_obj:
            print("ERROR: Class with 'Demo1' in name not found!")
            return
        class_id = class_obj.id
        print(f"  Found Class: '{class_obj.name}' (ID: {class_id}, Code: {class_obj.code})")

        a_res = await session.execute(select(Assignment).where(Assignment.class_id == class_id))
        assignment_obj = a_res.scalars().first()
        if not assignment_obj:
            print(f"ERROR: No assignment found in class '{class_obj.name}'!")
            return
        assignment_id = assignment_obj.id
        print(f"  Found Assignment: '{assignment_obj.title}' (ID: {assignment_id})")

        # Ensure all 10 students are enrolled in this class
        for item in MAPPING:
            stu_id = item["student_id"]
            enr_res = await session.execute(
                select(ClassEnrollment).where(
                    ClassEnrollment.class_id == class_id,
                    ClassEnrollment.student_id == stu_id,
                )
            )
            if not enr_res.scalar_one_or_none():
                enrollment = ClassEnrollment(class_id=class_id, student_id=stu_id)
                session.add(enrollment)
        await session.commit()
        print(f"  Verified all 10 students are enrolled in Class ID {class_id}.")

    # 3. Step 3: Authenticate each student and upload their renamed .ipynb notebook
    print(f"\n[Step 3] Submitting 10 notebooks for Assignment ID: {assignment_id}...")
    success_count = 0
    for item in renamed_files:
        stu_id = item["student_id"]
        filepath = item["filepath"]
        email = f"{stu_id}@dau.ac.in"
        password = str(stu_id)

        # Login
        r_login = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password})
        if r_login.status_code != 200:
            print(f"  FAILED to login as {email}: {r_login.text}")
            continue

        token = r_login.json()["access_token"]
        student_name = r_login.json()["name"]

        # Upload .ipynb notebook
        with open(filepath, "rb") as f:
            upload_files = {"file": (filepath.name, f, "application/json")}
            r_up = httpx.post(
                f"{BASE}/submissions/upload",
                data={"assignment_id": assignment_id},
                files=upload_files,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30.0,
            )

        if r_up.status_code == 200:
            res_data = r_up.json()
            success_count += 1
            print(f"  [OK] Student {stu_id} ({student_name}) -> Uploaded: {filepath.name} | Status: {res_data.get('status', 'pending')}")
        else:
            print(f"  [FAIL] Student {stu_id} -> Upload error ({r_up.status_code}): {r_up.text}")

    print("\n" + "=" * 70)
    print(f"  COMPLETED: {success_count}/10 student submissions uploaded successfully!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(setup_and_upload())
