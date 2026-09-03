import httpx
from datetime import datetime, timezone, timedelta

BASE = 'http://127.0.0.1:8000'

# 1. Login as Teacher
r_admin = httpx.post(f'{BASE}/auth/login', json={'email': 'admin@mlcourse.edu', 'password': 'admin123'})
teacher_token = r_admin.json()['access_token']
teacher_headers = {'Authorization': f'Bearer {teacher_token}'}

# 2. Find an assignment
r_classes = httpx.get(f'{BASE}/classes', headers=teacher_headers)
target_ass = None
for c in r_classes.json():
    r_ass = httpx.get(f'{BASE}/classes/{c["id"]}/assignments', headers=teacher_headers)
    assignments = r_ass.json()
    if assignments:
        target_ass = assignments[0]
        print(f'Found assignment in class "{c["name"]}" (ID: {target_ass["id"]})')
        break

assert target_ass is not None, "No assignments found to test edit!"
ass_id = target_ass["id"]

# 3. Teacher edits assignment: extend deadline, update student instructions and LLM prompt
new_deadline = (datetime.now(timezone.utc) + timedelta(days=21)).isoformat()
update_payload = {
    'title': target_ass['title'] + ' [Extended & Revised]',
    'description': 'Updated Instructions: Please implement full Adam optimizer and report final loss curves.',
    'rubric_text': 'Updated LLM Prompt:\n1. Architecture accuracy (35 marks)\n2. Convergence rate (35 marks)\n3. Visualization & summary (30 marks)',
    'max_marks': '100.0',
    'deadline': new_deadline
}

r_patch = httpx.patch(f'{BASE}/assignments/{ass_id}', data=update_payload, headers=teacher_headers)
assert r_patch.status_code == 200, f'Patch failed: {r_patch.text}'
updated = r_patch.json()

print('Successfully updated assignment:')
print('  New Title:', updated['title'])
print('  New Description:', updated['description'])
print('  New Rubric Text:', updated['rubric_text'])
print('  New Deadline:', updated['deadline'])

# 4. Verify unauthorized student cannot edit
r_stu = httpx.post(f'{BASE}/auth/login', json={'email': '202301002@dau.ac.in', 'password': '202301002'})
stu_token = r_stu.json()['access_token']
r_unauth = httpx.patch(f'{BASE}/assignments/{ass_id}', data=update_payload, headers={'Authorization': f'Bearer {stu_token}'})
print('Student edit attempt HTTP status:', r_unauth.status_code, '(Expected: 403)')
assert r_unauth.status_code == 403, "Student should not be able to edit assignment!"

print('\n>>> ASSIGNMENT EDIT & DEADLINE EXTENSION FULLY VERIFIED! <<<')
