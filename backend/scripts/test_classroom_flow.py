import httpx
from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE = 'http://127.0.0.1:8000'

print('==================================================================')
print('   GOOGLE CLASSROOM END-TO-END FLOW VERIFICATION')
print('==================================================================')

# 1. Teacher Logs In
print('\n[1] Teacher Logs In...')
r = httpx.post(f'{BASE}/auth/login', json={'email': 'admin@mlcourse.edu', 'password': 'admin123'})
assert r.status_code == 200, f'Teacher login failed: {r.text}'
teacher_token = r.json()['access_token']
teacher_headers = {'Authorization': f'Bearer {teacher_token}'}
print('    Teacher Authenticated:', r.json()['name'])

# 2. Teacher Creates a New Class
print('\n[2] Teacher Creates Class: "CS502: Advanced Neural Networks"...')
class_payload = {
    'name': 'CS502: Advanced Neural Networks',
    'section': 'Section B - Spring 2026',
    'color': 'linear-gradient(135deg, #7c3aed, #ec4899)'
}
r = httpx.post(f'{BASE}/classes', json=class_payload, headers=teacher_headers)
assert r.status_code == 201, f'Create class failed: {r.text}'
class_data = r.json()
class_id = class_data['id']
class_code = class_data['code']
print(f'    Class Created! ID: {class_id} | Name: {class_data["name"]}')
print(f'    Generated Unique Class Code: {class_code}')

# 3. Teacher Publishes Assignment with PDF Handout Attachment & Textual Rubric
print('\n[3] Teacher Publishes Lab Assignment with PDF Handout...')
dummy_pdf_content = b'%PDF-1.4 Mock Lab Handout PDF for Students'
deadline = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

form_data = {
    'title': 'Lab 1: Recurrent Neural Networks & LSTMs',
    'description': 'Implement LSTM cell from scratch and train on sentiment classification dataset.',
    'rubric_text': '1. Hidden state transitions (30 marks)\n2. Backprop through time (30 marks)\n3. Validation loss convergence (20 marks)\n4. Code comments & clarity (20 marks)',
    'max_marks': '100.0',
    'deadline': deadline,
}
files = {'attachment': ('lab1_lstm_handout.pdf', dummy_pdf_content, 'application/pdf')}

r = httpx.post(f'{BASE}/classes/{class_id}/assignments', data=form_data, files=files, headers=teacher_headers)
assert r.status_code == 201, f'Create assignment failed: {r.text}'
assignment_data = r.json()
assignment_id = assignment_data['id']
print(f'    Assignment Created! ID: {assignment_id} | Title: {assignment_data["title"]}')
print(f'    Handout Attachment: {assignment_data["attachment_name"]} (has_attachment={assignment_data["has_attachment"]})')

# 4. Student Logs In
print('\n[4] Student Logs In...')
r = httpx.post(f'{BASE}/auth/login', json={'email': 'alice@student.edu', 'password': 'student123'})
assert r.status_code == 200, f'Student login failed: {r.text}'
student_token = r.json()['access_token']
student_headers = {'Authorization': f'Bearer {student_token}'}
print('    Student Authenticated:', r.json()['name'])

# 5. Student Joins the Class Using Class Code
print(f'\n[5] Student Joins Class using Code "{class_code}"...')
r = httpx.post(f'{BASE}/classes/join', json={'code': class_code}, headers=student_headers)
assert r.status_code == 200, f'Join class failed: {r.text}'
joined_class = r.json()
print(f'    Successfully Enrolled in: {joined_class["name"]} (Students: {joined_class["student_count"]})')

# 6. Student Views Class Assignments & Downloads Attached Handout PDF
print('\n[6] Student Views Assignments & Downloads Handout PDF...')
r = httpx.get(f'{BASE}/classes/{class_id}/assignments', headers=student_headers)
assert r.status_code == 200
assignments_list = r.json()
print(f'    Student sees {len(assignments_list)} assignment(s) in this class.')

r_dl = httpx.get(f'{BASE}/assignments/{assignment_id}/attachment', headers=student_headers)
assert r_dl.status_code == 200, f'Download attachment failed: {r_dl.status_code}'
print(f'    Handout PDF Downloaded Successfully! ({len(r_dl.content)} bytes received)')

# 7. Student Submits .ipynb Notebook
print('\n[7] Student Submits .ipynb Notebook...')
sample_nb = Path('tests/fixtures/lab1_normal.ipynb')
with open(sample_nb, 'rb') as f:
    upload_files = {'file': ('alice_lstm_solution.ipynb', f, 'application/json')}
    r_up = httpx.post(f'{BASE}/submissions/upload', data={'assignment_id': assignment_id}, files=upload_files, headers=student_headers)
assert r_up.status_code == 200, f'Upload submission failed: {r_up.text}'
print(f'    Notebook Uploaded! Submission ID: {r_up.json()["id"]} | Status: {r_up.json()["status"]}')

# 8. Teacher Inspects Evaluation Tab
print('\n[8] Teacher Inspects Class Evaluation Table...')
r_eval = httpx.get(f'{BASE}/admin/assignments/{assignment_id}/grades', headers=teacher_headers)
assert r_eval.status_code == 200
grades_rows = r_eval.json()
print(f'    Evaluation Table Rows: {len(grades_rows)}')
for row in grades_rows:
    print(f'    - Student: {row["student_name"]} | Status: {row["submission_status"]} | Marks: {row["marks"]}')

# 9. Teacher Checks Class Roster
print('\n[9] Teacher Checks Class Roster (People Tab)...')
r_roster = httpx.get(f'{BASE}/classes/{class_id}/students', headers=teacher_headers)
assert r_roster.status_code == 200
print(f'    Enrolled Members: {len(r_roster.json())}')
for m in r_roster.json():
    print(f'    - {m["name"]} ({m["email"]})')

print('\n==================================================================')
print('   GOOGLE CLASSROOM ARCHITECTURE FULLY VERIFIED! (100% SUCCESS)')
print('==================================================================')
