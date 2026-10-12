"""
Seeds the Attendify database with departments, users (all roles), subjects,
timetable entries, and ~2 weeks of sample attendance history so every
dashboard has real data to show immediately.

Run with:  python seed.py
"""
import random
from datetime import date, timedelta

from app.database import Base, engine, SessionLocal
from app import models
from app.core.security import hash_password

DEFAULT_PASSWORD = "Attendify@123"

import os
import sys
from app.database import DB_PATH

# Safety: seed.py DELETES everything. Refuse to run over a database that
# already has users unless the person explicitly confirms.
if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) > 0:
    from sqlalchemy import inspect, text
    if "users" in inspect(engine).get_table_names():
        with engine.connect() as conn:
            existing_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if existing_users and existing_users > 0:
            print(f"STOP: {DB_PATH} already contains {existing_users} user(s).")
            print("Running seed.py would permanently delete all of them, plus every")
            print("subject, timetable slot and attendance record.")
            if input("Type YES (capital letters) to wipe everything anyway: ").strip() != "YES":
                print("Cancelled. Nothing was changed.")
                sys.exit(0)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ---------- Departments ----------
cse = models.Department(name="Computer Science & Engineering", code="CSE")
ece = models.Department(name="Electronics & Communication Engineering", code="ECE")
ise = models.Department(name="Information Science & Engineering", code="ISE")
db.add_all([cse, ece, ise])
db.flush()

# ---------- Admin ----------
admin = models.User(
    name="Priya Sharma",
    email="admin@gsssietw.edu",
    password_hash=hash_password(DEFAULT_PASSWORD),
    role=models.RoleEnum.admin,
)
db.add(admin)

# ---------- HOD (CSE) ----------
hod = models.User(
    name="Dr. Anitha Rao",
    email="hod.cse@gsssietw.edu",
    password_hash=hash_password(DEFAULT_PASSWORD),
    role=models.RoleEnum.hod,
    department_id=cse.id,
)
db.add(hod)
db.flush()
db.add(models.FacultyProfile(user_id=hod.id, designation="Head of Department"))

# ---------- Faculty (4, all CSE) ----------
faculty_names = [
    ("Prof. Kavya Nair", "faculty1@gsssietw.edu"),
    ("Prof. Sneha Patil", "faculty2@gsssietw.edu"),
    ("Prof. Meera Iyer", "faculty3@gsssietw.edu"),
    ("Prof. Divya Kulkarni", "faculty.cse@gsssietw.edu"),
]
faculty_users = []
for name, email in faculty_names:
    f = models.User(
        name=name,
        email=email,
        password_hash=hash_password(DEFAULT_PASSWORD),
        role=models.RoleEnum.faculty,
        department_id=cse.id,
    )
    db.add(f)
    db.flush()
    db.add(models.FacultyProfile(user_id=f.id, designation="Assistant Professor"))
    faculty_users.append(f)

# ---------- Subjects (CSE) ----------
subject_defs = [
    ("Data Structures", "CSE201"),
    ("Operating Systems", "CSE202"),
    ("Database Management Systems", "CSE203"),
    ("Computer Networks", "CSE204"),
]
subjects = []
for (name, code), fac in zip(subject_defs, faculty_users):
    s = models.Subject(name=name, code=code, department_id=cse.id, semester=3)
    db.add(s)
    subjects.append(s)
db.flush()

# ---------- Timetable (Mon-Fri, one slot per subject, section A) ----------
start_times = ["09:00", "10:00", "11:15", "12:15"]
end_times = ["10:00", "11:00", "12:15", "13:15"]
for day in range(5):  # Mon-Fri
    for i, subject in enumerate(subjects):
        entry = models.TimetableEntry(
            subject_id=subject.id,
            faculty_id=faculty_users[i].id,
            section="A",
            day_of_week=day,
            start_time=start_times[i],
            end_time=end_times[i],
            room=f"Room {201 + i}",
            semester=3,
            academic_year="2025-26",
        )
        db.add(entry)

# ---------- Students (CSE, section A, plus the demo login) ----------
student_names = [
    "Aisha Khan", "Bhavya Reddy", "Chandana Gowda", "Deepika Menon",
    "Esha Verma", "Farah Sheikh", "Gauri Joshi", "Harini Suresh",
    "Ishita Bose", "Jyothi Naik", "Kiran Shetty", "Lavanya Rao",
]
students = []

# The primary demo student account
demo_student = models.User(
    name="Ananya Deshpande",
    email="student@gsssietw.edu",
    password_hash=hash_password(DEFAULT_PASSWORD),
    role=models.RoleEnum.student,
    department_id=cse.id,
)
db.add(demo_student)
db.flush()
demo_profile = models.StudentProfile(
    user_id=demo_student.id, roll_no="1GS22CS001", section="A", year=2
)
db.add(demo_profile)
db.flush()
students.append(demo_profile)

for idx, name in enumerate(student_names, start=2):
    email = f"{name.split()[0].lower()}@gsssietw.edu"
    u = models.User(
        name=name,
        email=email,
        password_hash=hash_password(DEFAULT_PASSWORD),
        role=models.RoleEnum.student,
        department_id=cse.id,
    )
    db.add(u)
    db.flush()
    profile = models.StudentProfile(
        user_id=u.id, roll_no=f"1GS22CS{idx:03d}", section="A", year=2
    )
    db.add(profile)
    db.flush()
    students.append(profile)

# ---------- Classrooms (used by the Classroom Kiosk) ----------
for name, floor in (("Room 201", "2"), ("Room 202", "2"), ("Room 203", "2")):
    db.add(models.Classroom(name=name, building="Main Block", floor=floor, capacity=60, has_camera=True))

db.commit()

# ---------- Sample attendance history (last 14 days, weekdays only) ----------
random.seed(42)
today = date.today()
for days_ago in range(14, 0, -1):
    day = today - timedelta(days=days_ago)
    if day.weekday() >= 5:  # skip weekends
        continue
    for i, subject in enumerate(subjects):
        session = models.AttendanceSession(
            subject_id=subject.id,
            faculty_id=faculty_users[i].id,
            section="A",
            session_date=day,
        )
        db.add(session)
        db.flush()
        for profile in students:
            # demo student has a healthy ~85% attendance, others vary
            present_chance = 0.85 if profile.id == demo_profile.id else random.uniform(0.6, 0.95)
            status = models.AttendanceStatus.present if random.random() < present_chance else models.AttendanceStatus.absent
            db.add(models.AttendanceRecord(
                session_id=session.id,
                student_id=profile.id,
                status=status,
                method="manual",
            ))

db.commit()
db.close()

print("Seed complete.")
print(f"  Departments: CSE, ECE, ISE")
print(f"  Admin:    admin@gsssietw.edu")
print(f"  HOD:      hod.cse@gsssietw.edu")
print(f"  Faculty:  faculty1@gsssietw.edu, faculty2@gsssietw.edu, faculty3@gsssietw.edu, faculty.cse@gsssietw.edu")
print(f"  Student:  student@gsssietw.edu  (roll 1GS22CS001, section A)")
print(f"  + {len(student_names)} additional classmates in section A for realistic rosters")
print(f"  Password for ALL accounts: {DEFAULT_PASSWORD}")
