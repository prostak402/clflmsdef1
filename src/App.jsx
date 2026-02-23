import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useApp } from './context/useApp';
import AppLayout from './components/AppLayout';
import AuthPage from './pages/AuthPage';
import GenreSelectPage from './pages/GenreSelectPage';
import FeedPage from './pages/FeedPage';
import BookmarksPage from './pages/BookmarksPage';
import CatalogPage from './pages/CatalogPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({
  children,
  hideNav = false,
  requireOnboarding,
  requireAdmin = false,
}) {
  const { user, hasCompletedOnboarding } = useApp();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireOnboarding === true && !hasCompletedOnboarding) {
    return <Navigate to="/genres" replace />;
  }

  if (requireOnboarding === false && hasCompletedOnboarding) {
    return <Navigate to="/feed" replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to={hasCompletedOnboarding ? '/feed' : '/genres'} replace />;
  }

  return <AppLayout hideNav={hideNav}>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, hasCompletedOnboarding } = useApp();

  return (
    <Routes>
      <Route
        path="/"
        element={
          user
            ? <Navigate to={hasCompletedOnboarding ? '/feed' : '/genres'} replace />
            : <AuthPage />
        }
      />
      <Route
        path="/genres"
        element={
          <ProtectedRoute hideNav requireOnboarding={false}>
            <GenreSelectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute requireOnboarding>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute requireOnboarding>
            <BookmarksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/catalog"
        element={
          <ProtectedRoute requireOnboarding>
            <CatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute requireOnboarding>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireOnboarding requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
