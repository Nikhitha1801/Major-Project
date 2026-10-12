from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- Department ----------
class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str
    code: str


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


# ---------- User ----------
class StudentProfileOut(BaseModel):
    id: int
    roll_no: str
    section: str
    year: int
    face_registered: bool

    class Config:
        from_attributes = True


class FacultyProfileOut(BaseModel):
    designation: str

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    department: Optional[DepartmentOut] = None
    student_profile: Optional[StudentProfileOut] = None
    faculty_profile: Optional[FacultyProfileOut] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    department_id: Optional[int] = None
    roll_no: Optional[str] = None
    section: Optional[str] = None
    year: Optional[int] = None
    designation: Optional[str] = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    department_id: Optional[int] = None
    roll_no: Optional[str] = None
    section: Optional[str] = "A"
    year: Optional[int] = 1
    designation: Optional[str] = None


# ---------- Subject / Timetable ----------
class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    semester: int
    department_id: int

    class Config:
        from_attributes = True


class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: int
    semester: int = 1


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[int] = None
    semester: Optional[int] = None


class TimetableEntryOut(BaseModel):
    id: int
    subject: SubjectOut
    section: str
    day_of_week: int
    start_time: str
    end_time: str
    room: str
    faculty_id: int
    semester: int
    academic_year: str

    class Config:
        from_attributes = True


class TimetableEntryUpdate(BaseModel):
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    section: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    semester: Optional[int] = None
    academic_year: Optional[str] = None


class NewSemesterRequest(BaseModel):
    semester: int
    academic_year: str
    confirm: bool = False  # must be explicitly true -- this wipes timetable + attendance


class NewSemesterResult(BaseModel):
    cleared_timetable_entries: int
    cleared_attendance_sessions: int
    cleared_attendance_records: int
    semester: int
    academic_year: str


# ---------- Attendance ----------
class AttendanceMarkItem(BaseModel):
    student_id: int
    status: str  # present | absent


class AttendanceSubmit(BaseModel):
    subject_id: int
    section: str
    session_date: Optional[date] = None
    records: List[AttendanceMarkItem]


class AttendanceRecordOut(BaseModel):
    student_id: int
    status: str

    class Config:
        from_attributes = True


class AttendanceSessionOut(BaseModel):
    id: int
    subject: SubjectOut
    section: str
    session_date: date
    records: List[AttendanceRecordOut]

    class Config:
        from_attributes = True


class StudentAttendanceSummary(BaseModel):
    subject_id: int
    subject_name: str
    total_sessions: int
    present_count: int
    percentage: float


# ---------- Live class / Start Class flow ----------
class LiveSlotOut(BaseModel):
    timetable_entry_id: int
    subject_id: int
    subject_name: str
    section: str
    room: str
    start_time: str
    end_time: str
    status: str  # "now" | "upcoming" | "past"
    is_swapped_in: bool  # true if you're covering this slot via an approved swap
    existing_session_id: Optional[int] = None
    existing_session_status: Optional[str] = None


class SessionStartRequest(BaseModel):
    timetable_entry_id: int


class SessionStartOut(BaseModel):
    session_id: int
    status: str
    subject_name: str
    section: str
    roster_size: int
    room: str = ""
    end_time: str = ""


class CaptureRequest(BaseModel):
    image: str  # base64 data URL, one webcam frame


class MatchedStudent(BaseModel):
    student_id: int
    name: str
    roll_no: str


class FaceDetection(BaseModel):
    box: List[int]  # [x, y, w, h] in the captured frame's pixel space
    matched: bool
    student_id: Optional[int] = None
    name: Optional[str] = None
    roll_no: Optional[str] = None
    confidence: float = 0.0  # 0-100%, higher = more confident match
    in_roster: bool = True   # false if matched but not enrolled in this section
    liveness: str = "n/a"    # "n/a" | "verifying" | "confirmed" | "suspected_photo"


class CaptureResult(BaseModel):
    newly_matched: List[MatchedStudent]
    present_count: int
    roster_size: int
    faces_detected: int
    detections: List[FaceDetection] = []
    room: str = ""


class SessionCompleteOut(BaseModel):
    session_id: int
    present_count: int
    absent_count: int
    roster_size: int
    report_emailed: bool
    email_note: str


class LiveSessionOut(BaseModel):
    session_id: int
    subject_name: str
    section: str
    faculty_name: str
    room: str
    started_at: Optional[datetime]
    present_count: int
    roster_size: int


# ---------- Swap requests ----------
class SwapRequestCreate(BaseModel):
    timetable_entry_id: int
    swap_date: date
    reason: str = ""
    target_faculty_id: Optional[int] = None


class SwapRequestOut(BaseModel):
    id: int
    timetable_entry_id: int
    subject_name: str
    section: str
    day_of_week: int
    start_time: str
    end_time: str
    requesting_faculty_id: int
    requesting_faculty_name: str
    target_faculty_id: Optional[int] = None
    target_faculty_name: Optional[str] = None
    swap_date: date
    reason: str
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SwapDecisionRequest(BaseModel):
    approve: bool
    target_faculty_id: Optional[int] = None  # HOD can assign/override the covering faculty when approving


# ---------- Classrooms ----------
class ClassroomOut(BaseModel):
    id: int
    name: str
    building: str
    floor: str
    capacity: int
    has_camera: bool

    class Config:
        from_attributes = True


class ClassroomCreate(BaseModel):
    name: str
    building: str = ""
    floor: str = ""
    capacity: int = 60
    has_camera: bool = False


class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    capacity: Optional[int] = None
    has_camera: Optional[bool] = None


# ---------- Audit logs ----------
class AuditLogOut(BaseModel):
    id: int
    actor_name: str
    actor_role: str
    action: str
    target_type: str
    target_id: Optional[int] = None
    detail: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Timetable bulk upload ----------
class TimetableUploadRow(BaseModel):
    row: int
    ok: bool
    message: str


class TimetableUploadResult(BaseModel):
    created: int
    failed: int
    rows: List[TimetableUploadRow]


# ---------- System settings ----------
class SystemSettingsOut(BaseModel):
    attendance_offset_minutes: int
    attendance_window_minutes: int

    class Config:
        from_attributes = True


class SystemSettingsUpdate(BaseModel):
    attendance_offset_minutes: Optional[int] = None
    attendance_window_minutes: Optional[int] = None


# ---------- Classroom Kiosk (automatic attendance, no faculty action) ----------
class RoomWindowOut(BaseModel):
    room: str
    status: str  # "idle" | "window_open" | "in_progress" | "just_completed"
    timetable_entry_id: Optional[int] = None
    subject_name: Optional[str] = None
    section: Optional[str] = None
    faculty_name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    window_start: Optional[str] = None
    window_end: Optional[str] = None
    session_id: Optional[int] = None
    session_status: Optional[str] = None
    present_count: int = 0
    roster_size: int = 0
    next_start_time: Optional[str] = None
    next_subject_name: Optional[str] = None
    offset_minutes: int = 15
    window_minutes: int = 15
