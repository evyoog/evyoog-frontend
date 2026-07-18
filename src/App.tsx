import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoadingSpinner from './components/ui/LoadingSpinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JournalEntryPage from './pages/JournalEntryPage';
import TrialBalancePage from './pages/TrialBalancePage';
import PLStatementPage from './pages/PLStatementPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/journals/new"
            element={
              <ProtectedRoute>
                <JournalEntryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trial-balance"
            element={
              <ProtectedRoute>
                <TrialBalancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pl-statement"
            element={
              <ProtectedRoute>
                <PLStatementPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
