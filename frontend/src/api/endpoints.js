import client from './client'

// ---------- Auth ----------
export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((r) => r.data)

export const getMe = () => client.get('/auth/me').then((r) => r.data)

// ---------- Dashboard ----------
export const getAdminDashboard = () => client.get('/dashboard/admin').then((r) => r.data)
export const getAdminAnalytics = () => client.get('/dashboard/admin/analytics').then((r) => r.data)
export const getHodDashboard = () => client.get('/dashboard/hod').then((r) => r.data)
export const getHodAnalytics = () => client.get('/dashboard/hod/analytics').then((r) => r.data)
export const getFacultyDashboard = () => client.get('/dashboard/faculty').then((r) => r.data)
export const getStudentDashboard = () => client.get('/dashboard/student').then((r) => r.data)

// ---------- Users ----------
export const listUsers = (params = {}) => client.get('/users', { params }).then((r) => r.data)
export const createUser = (payload) => client.post('/users', payload).then((r) => r.data)
export const updateUser = (id, payload) => client.put(`/users/${id}`, payload).then((r) => r.data)
export const deleteUser = (id) => client.delete(`/users/${id}`)

// ---------- Departments ----------
export const listDepartments = () => client.get('/departments').then((r) => r.data)
export const createDepartment = (payload) => client.post('/departments', payload).then((r) => r.data)
export const updateDepartment = (id, payload) => client.put(`/departments/${id}`, payload).then((r) => r.data)
export const deleteDepartment = (id, force = false) => client.delete(`/departments/${id}`, { params: { force } })

// ---------- Academics ----------
export const listSubjects = (params = {}) => client.get('/subjects', { params }).then((r) => r.data)
export const createSubject = (payload) => client.post('/subjects', payload).then((r) => r.data)
export const updateSubject = (id, payload) => client.put(`/subjects/${id}`, payload).then((r) => r.data)
export const deleteSubject = (id, force = false) => client.delete(`/subjects/${id}`, { params: { force } })
export const listTimetable = (params = {}) => client.get('/timetable', { params }).then((r) => r.data)
export const createTimetableEntry = (params) => client.post('/timetable', null, { params }).then((r) => r.data)
export const updateTimetableEntry = (id, payload) => client.put(`/timetable/${id}`, payload).then((r) => r.data)
export const deleteTimetableEntry = (id) => client.delete(`/timetable/${id}`)
export const startNewSemester = (payload) => client.post('/academics/new-semester', payload).then((r) => r.data)
export const bulkUploadTimetable = (file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/timetable/bulk-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

// ---------- Start Class (timetable-linked webcam attendance) ----------
export const getLiveSlots = () => client.get('/attendance/live-slot').then((r) => r.data)
export const startClassSession = (timetableEntryId) =>
  client.post('/attendance/sessions/start', { timetable_entry_id: timetableEntryId }).then((r) => r.data)
export const captureAttendanceFrame = (sessionId, image) =>
  client.post(`/attendance/sessions/${sessionId}/capture`, { image }).then((r) => r.data)
export const completeClassSession = (sessionId) =>
  client.post(`/attendance/sessions/${sessionId}/complete`).then((r) => r.data)
export const listLiveSessions = () => client.get('/attendance/live-sessions').then((r) => r.data)
export const getIpCameraFrame = (url) =>
  client.post('/camera/frame', { url }, { responseType: 'blob' }).then((r) => r.data)

// ---------- Classroom Kiosk (fully automatic attendance) ----------
export const getRoomWindow = (room) => client.get('/attendance/room-window', { params: { room } }).then((r) => r.data)
export const autoStartClassSession = (timetableEntryId) =>
  client.post('/attendance/sessions/auto-start', { timetable_entry_id: timetableEntryId }).then((r) => r.data)

// ---------- System Settings ----------
export const getSystemSettings = () => client.get('/settings').then((r) => r.data)
export const updateSystemSettings = (payload) => client.put('/settings', payload).then((r) => r.data)

// ---------- Swap Requests ----------
export const listSwapRequests = (params = {}) => client.get('/swap-requests', { params }).then((r) => r.data)
export const createSwapRequest = (payload) => client.post('/swap-requests', payload).then((r) => r.data)
export const decideSwapRequest = (id, approve, targetFacultyId = null) =>
  client.patch(`/swap-requests/${id}`, { approve, target_faculty_id: targetFacultyId }).then((r) => r.data)

// ---------- Classrooms ----------
export const listClassrooms = () => client.get('/classrooms').then((r) => r.data)
export const createClassroom = (payload) => client.post('/classrooms', payload).then((r) => r.data)
export const updateClassroom = (id, payload) => client.put(`/classrooms/${id}`, payload).then((r) => r.data)
export const deleteClassroom = (id) => client.delete(`/classrooms/${id}`)

// ---------- Audit Logs ----------
export const listAuditLogs = (params = {}) => client.get('/audit-logs', { params }).then((r) => r.data)

// ---------- Attendance ----------
export const submitAttendance = (payload) =>
  client.post('/attendance/sessions', payload).then((r) => r.data)
export const listSessions = (params = {}) =>
  client.get('/attendance/sessions', { params }).then((r) => r.data)
export const myAttendanceSummary = () =>
  client.get('/attendance/my-summary').then((r) => r.data)
export const myAttendanceRecords = () =>
  client.get('/attendance/my-records').then((r) => r.data)
export const studentAttendanceSummary = (studentId) =>
  client.get(`/attendance/student/${studentId}/summary`).then((r) => r.data)

// ---------- Face ----------
export const registerFace = (images) =>
  client.post('/face/register', { images }).then((r) => r.data)
export const faceStatus = () => client.get('/face/status').then((r) => r.data)

// ---------- Reports ----------
export const downloadAttendanceExcel = async (params = {}) => {
  const res = await client.get('/reports/attendance/excel', {
    params,
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'attendance_report.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
