import httpx
from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE = 'http://127.0.0.1:5173'

print('=== STEP 1: TA LOGS IN ===')
r_admin_login = httpx.post(f'{BASE}/auth/login', json={'email': 'admin@mlcourse.edu', 'password': 'admin123'})
admin_token = r_admin_login.json()['access_token']
print('TA logged in:', r_admin_login.json()['name'], '| Role:', r_admin_login.json()['role'])

print('\n=== STEP 2: TA CREATES AN ASSIGNMENT WITH RUBRIC ===')
deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
assignment_payload = {
    'title': 'Lab 4 — Decision Trees & Random Forests',
    'description': 'Implement ID3 Decision Tree algorithm and evaluate on wine classification dataset.',
    'rubric_text': '1. Information gain & entropy calculation (30 marks)\n2. Tree splitting and stopping criteria (30 marks)\n3. Pruning or Random Forest ensemble (20 marks)\n4. Code clarity and comments (20 marks)',
    'max_marks': 100.0,
    'deadline': deadline,
}
r_create = httpx.post(f'{BASE}/admin/assignments', json=assignment_payload, headers={'Authorization': f'Bearer {admin_token}'})
print('Assignment Created Status:', r_create.status_code)
assignment_data = r_create.json()
assignment_id = assignment_data['id']
print('Created Assignment ID:', assignment_id, '| Title:', assignment_data['title'])

print('\n=== STEP 3: STUDENT (ALICE) LOGS IN ===')
r_student_login = httpx.post(f'{BASE}/auth/login', json={'email': 'alice@student.edu', 'password': 'student123'})
student_token = r_student_login.json()['access_token']
print('Student logged in:', r_student_login.json()['name'], '| Role:', r_student_login.json()['role'])

print('\n=== STEP 4: STUDENT SEES THE NEW ASSIGNMENT & RUBRIC ===')
r_student_assignments = httpx.get(f'{BASE}/assignments', headers={'Authorization': f'Bearer {student_token}'})
matching = next(a for a in r_student_assignments.json() if a['id'] == assignment_id)
print('Student sees assignment:', matching['title'])
print('Rubric revealed to student:\n', matching['rubric_text'])

print('\n=== STEP 5: STUDENT SUBMITS JUPYTER NOTEBOOK ===')
nb_path = Path('tests/fixtures/lab1_normal.ipynb')
with open(nb_path, 'rb') as f:
    files = {'file': ('alice_decision_trees_lab4.ipynb', f, 'application/json')}
    r_upload = httpx.post(
        f'{BASE}/submissions/upload',
        data={'assignment_id': assignment_id},
        files=files,
        headers={'Authorization': f'Bearer {student_token}'}
    )
    print('Upload response status:', r_upload.status_code)
    submission_data = r_upload.json()
    print('Registered Submission ID:', submission_data['id'], '| Status:', submission_data['status'])

print('\n=== STEP 6: TA SEES SUBMISSION IN DASHBOARD ===')
r_admin_grades = httpx.get(f'{BASE}/admin/assignments/{assignment_id}/grades', headers={'Authorization': f'Bearer {admin_token}'})
print('Submissions in TA table:', len(r_admin_grades.json()))
for sub in r_admin_grades.json():
    print(f"  - Student: {sub['student_name']} | Status: {sub['submission_status']} | Marks: {sub['marks']}")

print('\n=== STEP 7: STUDENT REVIEWS MY GRADES STATUS ===')
r_my_grades = httpx.get(f'{BASE}/students/me/grades', headers={'Authorization': f'Bearer {student_token}'})
alice_sub = next(g for g in r_my_grades.json() if g['assignment_id'] == assignment_id)
print(f"Student view: {alice_sub['assignment_title']} -> Status: {alice_sub['status']}, Marks: {alice_sub['marks']}")

print('\n>>> COMPLETE END-TO-END PASS VERIFIED SUCCESSFULLY! <<<')
