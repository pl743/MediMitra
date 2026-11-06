import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { GuestRoute } from './components/GuestRoute.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { DoctorsPage } from './pages/DoctorsPage.jsx';
import { DoctorProfilePage } from './pages/DoctorProfilePage.jsx';
import { CareJourneyPage } from './pages/CareJourneyPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LabTestsPage } from './pages/LabTestsPage.jsx';
import { LabDetailsPage } from './pages/LabDetailsPage.jsx';
import { LabTestDetailPage } from './pages/LabTestDetailPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { MedicinesPage } from './pages/MedicinesPage.jsx';
import { MyAppointmentsPage } from './pages/MyAppointmentsPage.jsx';
import { MyLabBookingsPage } from './pages/MyLabBookingsPage.jsx';
import { MyReservationsPage } from './pages/MyReservationsPage.jsx';
import { PharmacyInventoryPage } from './pages/PharmacyInventoryPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { ConsentManagementPage } from './pages/ConsentManagementPage.jsx';
import { MyWaitlistPage } from './pages/MyWaitlistPage.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="doctors/:doctorId" element={<DoctorProfilePage />} />
          <Route path="lab-tests" element={<LabTestsPage />} />
          <Route path="lab-tests/:testId" element={<LabTestDetailPage />} />
          <Route path="labs/:labId" element={<LabDetailsPage />} />
          <Route path="medicines" element={<MedicinesPage />} />
          <Route
            path="care-journey"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <CareJourneyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="consents"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <ConsentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="waitlist"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MyWaitlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="appointments"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MyAppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="lab-bookings"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MyLabBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reservations/my"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MyReservationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="pharmacy/inventory"
            element={
              <ProtectedRoute allowedRoles={['pharmacist']}>
                <PharmacyInventoryPage />
              </ProtectedRoute>
            }
          />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
