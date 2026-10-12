import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'

import LoginPage from './pages/LoginPage.jsx'

import AdminOverview from './pages/admin/AdminOverview.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminDepartments from './pages/admin/AdminDepartments.jsx'
import AdminSubjects from './pages/admin/AdminSubjects.jsx'
import AdminClassrooms from './pages/admin/AdminClassrooms.jsx'
import AdminTimetable from './pages/admin/AdminTimetable.jsx'
import AdminAttendance from './pages/admin/AdminAttendance.jsx'
import AdminReports from './pages/hod/HodReports.jsx'
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx'
import AdminCameras from './pages/admin/AdminCameras.jsx'
import AdminAuditLogs from './pages/admin/AdminAuditLogs.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'
import ClassroomKiosk from './pages/admin/ClassroomKiosk.jsx'
import KioskAttendance from './pages/admin/KioskAttendance.jsx'

import HodOverview from './pages/hod/HodOverview.jsx'
import HodFaculty from './pages/hod/HodFaculty.jsx'
import HodAttendance from './pages/hod/HodAttendance.jsx'
import HodAnalytics from './pages/hod/HodAnalytics.jsx'
import HodRecordings from './pages/hod/HodRecordings.jsx'
import HodReports from './pages/hod/HodReports.jsx'
import HodSwapRequests from './pages/hod/HodSwapRequests.jsx'

import FacultyOverview from './pages/faculty/FacultyOverview.jsx'
import TakeAttendance from './pages/faculty/TakeAttendance.jsx'
import FacultyTimetable from './pages/faculty/FacultyTimetable.jsx'
import FacultyAttendanceLog from './pages/faculty/FacultyAttendanceLog.jsx'
import FacultyReports from './pages/faculty/FacultyReports.jsx'
import FacultySwapRequests from './pages/faculty/FacultySwapRequests.jsx'
import FacultyNotifications from './pages/faculty/FacultyNotifications.jsx'

import StudentOverview from './pages/student/StudentOverview.jsx'
import StudentAttendanceHistory from './pages/student/StudentAttendanceHistory.jsx'
import StudentHistory from './pages/student/StudentHistory.jsx'
import FaceRegistration from './pages/student/FaceRegistration.jsx'
import StudentAnalytics from './pages/student/StudentAnalytics.jsx'
import StudentProfile from './pages/student/StudentProfile.jsx'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/kiosk"
            element={
              <ProtectedRoute roles={['admin', 'hod']}>
                <ClassroomKiosk />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="classrooms" element={<AdminClassrooms />} />
            <Route path="timetable" element={<AdminTimetable />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="cameras" element={<AdminCameras />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="kiosk" element={<KioskAttendance />} />
          </Route>

          <Route
            path="/hod"
            element={
              <ProtectedRoute roles={['hod']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HodOverview />} />
            <Route path="faculty" element={<HodFaculty />} />
            <Route path="attendance" element={<HodAttendance />} />
            <Route path="analytics" element={<HodAnalytics />} />
            <Route path="recordings" element={<HodRecordings />} />
            <Route path="reports" element={<HodReports />} />
            <Route path="swap-requests" element={<HodSwapRequests />} />
          </Route>

          <Route
            path="/faculty"
            element={
              <ProtectedRoute roles={['faculty']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<FacultyOverview />} />
            <Route path="attendance" element={<TakeAttendance />} />
            <Route path="timetable" element={<FacultyTimetable />} />
            <Route path="log" element={<FacultyAttendanceLog />} />
            <Route path="reports" element={<FacultyReports />} />
            <Route path="swap-requests" element={<FacultySwapRequests />} />
            <Route path="notifications" element={<FacultyNotifications />} />
          </Route>

          <Route
            path="/student"
            element={
              <ProtectedRoute roles={['student']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentOverview />} />
            <Route path="attendance" element={<StudentAttendanceHistory />} />
            <Route path="history" element={<StudentHistory />} />
            <Route path="face" element={<FaceRegistration />} />
            <Route path="analytics" element={<StudentAnalytics />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
