import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, Date,
    Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship

from .database import Base


class RoleEnum(str, enum.Enum):
    admin = "admin"
    hod = "hod"
    faculty = "faculty"
    student = "student"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"


class SessionStatus(str, enum.Enum):
    live = "live"          # class started, capture in progress
    completed = "completed"  # class ended, roster finalized, report sent


class SwapStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Classroom(Base):
    """Physical room directory managed by admin. Timetable entries still
    store `room` as free text for backward compatibility, but new/edited
    slots are expected to reference one of these by name."""
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # e.g. "Room 201"
    building = Column(String, default="")
    floor = Column(String, default="")
    capacity = Column(Integer, default=60)
    has_camera = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """Trail of admin/HOD actions: user changes, timetable edits, semester
    resets, swap decisions, classroom changes."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String, default="")
    actor_role = Column(String, default="")
    action = Column(String, nullable=False)  # e.g. "user.create", "swap.approve"
    target_type = Column(String, default="")
    target_id = Column(Integer, nullable=True)
    detail = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    actor = relationship("User")


class SystemSettings(Base):
    """Single-row table of tunable, app-wide behavior. Row id is always 1."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, default=1)
    # Automatic attendance: capture begins this many minutes after each
    # class's scheduled start, and runs for this many minutes before
    # auto-completing and emailing the report -- no faculty action needed.
    attendance_offset_minutes = Column(Integer, default=15)
    attendance_window_minutes = Column(Integer, default=15)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="department")
    subjects = relationship("Subject", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    department = relationship("Department", back_populates="users")
    student_profile = relationship(
        "StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    faculty_profile = relationship(
        "FacultyProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    roll_no = Column(String, unique=True, nullable=False)
    section = Column(String, nullable=False, default="A")
    year = Column(Integer, nullable=False, default=1)
    face_registered = Column(Boolean, default=False)

    user = relationship("User", back_populates="student_profile")
    attendance_records = relationship("AttendanceRecord", back_populates="student")


class FacultyProfile(Base):
    __tablename__ = "faculty_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    designation = Column(String, default="Assistant Professor")

    user = relationship("User", back_populates="faculty_profile")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester = Column(Integer, default=1)

    department = relationship("Department", back_populates="subjects")
    timetable_entries = relationship("TimetableEntry", back_populates="subject")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    section = Column(String, nullable=False, default="A")
    day_of_week = Column(Integer, nullable=False)  # 0=Mon ... 6=Sun
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)  # "10:00"
    room = Column(String, default="")
    semester = Column(Integer, default=1)
    academic_year = Column(String, default="")  # e.g. "2026-27"

    subject = relationship("Subject", back_populates="timetable_entries")
    faculty = relationship("User")
    swap_requests = relationship(
        "SwapRequest", back_populates="timetable_entry", cascade="all, delete-orphan"
    )


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    section = Column(String, nullable=False, default="A")
    session_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Populated when the session originates from the timetable-linked
    # "Start Class" flow. Null for legacy/manual submissions.
    timetable_entry_id = Column(Integer, ForeignKey("timetable_entries.id"), nullable=True)
    status = Column(SAEnum(SessionStatus), default=SessionStatus.completed)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    report_emailed = Column(Boolean, default=False)

    subject = relationship("Subject")
    faculty = relationship("User")
    timetable_entry = relationship("TimetableEntry")
    records = relationship(
        "AttendanceRecord", back_populates="session", cascade="all, delete-orphan"
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_session_student"),)

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    status = Column(SAEnum(AttendanceStatus), default=AttendanceStatus.absent)
    marked_at = Column(DateTime, default=datetime.utcnow)
    method = Column(String, default="manual")  # manual | face

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("StudentProfile", back_populates="attendance_records")


class SwapRequest(Base):
    """
    A faculty member asking to swap who takes a specific timetable slot on a
    specific date (e.g. covering each other's lectures). HOD approves or
    rejects. An approved swap changes who the "effective" faculty is for
    that slot on that date, for both the Start Class flow and rosters.
    """
    __tablename__ = "swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    timetable_entry_id = Column(Integer, ForeignKey("timetable_entries.id"), nullable=False)
    requesting_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    swap_date = Column(Date, nullable=False)
    reason = Column(String, default="")
    status = Column(SAEnum(SwapStatus), default=SwapStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)

    timetable_entry = relationship("TimetableEntry", back_populates="swap_requests")
    requesting_faculty = relationship("User", foreign_keys=[requesting_faculty_id])
    target_faculty = relationship("User", foreign_keys=[target_faculty_id])
    decided_by = relationship("User", foreign_keys=[decided_by_id])
