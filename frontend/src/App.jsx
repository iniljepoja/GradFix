import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import MapPage from './features/map/MapPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RegisterPage from './features/auth/RegisterPage.jsx';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './features/auth/ResetPasswordPage.jsx';
import VerifyEmailPage from './features/auth/VerifyEmailPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import NewReportPage from './features/reports/NewReportPage.jsx';
import ReportDetailPage from './features/reports/ReportDetailPage.jsx';
import StatsPage from './features/stats/StatsPage.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminLayout from './features/admin/AdminLayout.jsx';
import ReportsQueuePage from './features/admin/ReportsQueuePage.jsx';
import AdminReportDetailPage from './features/admin/AdminReportDetailPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Public */}
        <Route path="/" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />

        {/* Authenticated */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/reports/new" element={
          <ProtectedRoute requireVerified><NewReportPage /></ProtectedRoute>} />

        {/* Admin panel (staff only) */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="/admin/reports" replace />} />
          <Route path="reports" element={<ReportsQueuePage />} />
          <Route path="reports/:id" element={<AdminReportDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
