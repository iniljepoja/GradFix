import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout.jsx';
import CitizenRoute from './components/CitizenRoute.jsx';
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
import AdminDashboardPage from './features/admin/AdminDashboardPage.jsx';
import ReportsQueuePage from './features/admin/ReportsQueuePage.jsx';
import AdminReportDetailPage from './features/admin/AdminReportDetailPage.jsx';
import WorkOrdersPage from './features/admin/WorkOrdersPage.jsx';
import PlatformAdminPage from './features/admin/PlatformAdminPage.jsx';
import PlatformTenantsPage from './features/admin/PlatformTenantsPage.jsx';
import PlatformTenantDetailPage from './features/admin/PlatformTenantDetailPage.jsx';
import PlatformTenantAdminsPage from './features/admin/PlatformTenantAdminsPage.jsx';
import PlatformEntitiesPage from './features/admin/PlatformEntitiesPage.jsx';
import PlatformReportsPage from './features/admin/PlatformReportsPage.jsx';
import PlatformWorkOrdersPage from './features/admin/PlatformWorkOrdersPage.jsx';
import ResponsibleEntitiesPage from './features/admin/ResponsibleEntitiesPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  return (
    <Layout>
      <ServiceWorkerMessenger />
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
        <Route path="/dashboard" element={<CitizenRoute><DashboardPage /></CitizenRoute>} />
        <Route path="/reports/new" element={
          <CitizenRoute requireVerified><NewReportPage /></CitizenRoute>} />

        {/* Admin panel (staff only) */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminHome />} />
          <Route path="reports" element={<TenantAdminOnly><ReportsQueuePage /></TenantAdminOnly>} />
          <Route path="reports/:id" element={<TenantAdminOnly><AdminReportDetailPage /></TenantAdminOnly>} />
          <Route path="work-orders" element={<TenantAdminOnly><WorkOrdersPage /></TenantAdminOnly>} />
          <Route path="entities" element={<TenantAdminOnly><ResponsibleEntitiesPage /></TenantAdminOnly>} />
          <Route path="platform" element={<SuperAdminOnly><PlatformAdminPage /></SuperAdminOnly>} />
          <Route path="platform/tenants" element={<SuperAdminOnly><PlatformTenantsPage /></SuperAdminOnly>} />
          <Route path="platform/tenants/:id" element={<SuperAdminOnly><PlatformTenantDetailPage /></SuperAdminOnly>} />
          <Route path="platform/admins" element={<SuperAdminOnly><PlatformTenantAdminsPage /></SuperAdminOnly>} />
          <Route path="platform/entities" element={<SuperAdminOnly><PlatformEntitiesPage /></SuperAdminOnly>} />
          <Route path="platform/reports" element={<SuperAdminOnly><PlatformReportsPage /></SuperAdminOnly>} />
          <Route path="platform/work-orders" element={<SuperAdminOnly><PlatformWorkOrdersPage /></SuperAdminOnly>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AdminHome() {
  const { user } = useAuth();
  if (user?.role === 'super_admin') return <Navigate to="/admin/platform" replace />;
  return <AdminDashboardPage />;
}

function TenantAdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'tenant_admin') return <Navigate to="/admin/platform" replace />;
  return children;
}

function SuperAdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') return <Navigate to="/admin" replace />;
  return children;
}

// When a push notification is clicked, the service worker asks the open app to navigate.
function ServiceWorkerMessenger() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'navigate') navigate(event.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
  return null;
}
