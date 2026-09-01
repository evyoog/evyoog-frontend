import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoadingSpinner from './components/ui/LoadingSpinner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JournalEntryPage from './pages/JournalEntryPage';
import JournalListingPage from './pages/JournalListingPage';
import TrialBalancePage from './pages/TrialBalancePage';
import PLStatementPage from './pages/PLStatementPage';
import BalanceSheetPage from './pages/BalanceSheetPage';
import AccountLedgerPage from './pages/AccountLedgerPage';
import CashFlowPage from './pages/CashFlowPage';
import PeriodManagementPage from './pages/PeriodManagementPage';
import FinanceDimensionsPage from './pages/FinanceDimensionsPage';
import ChartOfAccountsPage from './pages/ChartOfAccountsPage';
import AccountCombinationsPage from './pages/AccountCombinationsPage';
import CoaStructurePage from './pages/CoaStructurePage';
import DimensionValuesPage from './pages/DimensionValuesPage';
import LedgerSetupPage from './pages/LedgerSetupPage';
import UserManagementPage from './pages/UserManagementPage';
import RoleManagementPage from './pages/RoleManagementPage';
import ApprovalPolicyPage from './pages/ApprovalPolicyPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import EnterpriseStructurePage from './pages/EnterpriseStructurePage';
import AieImportPage from './pages/AieImportPage';
import OpeningBalanceImportPage from './pages/OpeningBalanceImportPage';
import CalendarManagementPage from './pages/CalendarManagementPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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
              path="/journals"
              element={
                <ProtectedRoute>
                  <JournalListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aie-import"
              element={
                <ProtectedRoute>
                  <AieImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/opening-balance-import"
              element={
                <ProtectedRoute>
                  <OpeningBalanceImportPage />
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
            <Route
              path="/balance-sheet"
              element={
                <ProtectedRoute>
                  <BalanceSheetPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account-ledger"
              element={
                <ProtectedRoute>
                  <AccountLedgerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cash-flow"
              element={
                <ProtectedRoute>
                  <CashFlowPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/period-management"
              element={
                <ProtectedRoute>
                  <PeriodManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/enterprise"
              element={
                <ProtectedRoute>
                  <EnterpriseStructurePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance-dimensions"
              element={
                <ProtectedRoute>
                  <FinanceDimensionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chart-of-accounts"
              element={
                <ProtectedRoute>
                  <ChartOfAccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account-combinations"
              element={
                <ProtectedRoute>
                  <AccountCombinationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coa-structure"
              element={
                <ProtectedRoute>
                  <CoaStructurePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dimension-values"
              element={
                <ProtectedRoute>
                  <DimensionValuesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ledger-setup"
              element={
                <ProtectedRoute>
                  <LedgerSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar-management"
              element={
                <ProtectedRoute>
                  <CalendarManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <ProtectedRoute>
                  <RoleManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approval-policy"
              element={
                <ProtectedRoute>
                  <ApprovalPolicyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
