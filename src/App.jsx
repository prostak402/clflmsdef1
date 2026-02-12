import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import AppLayout from './components/AppLayout';
import AuthPage from './pages/AuthPage';
import GenreSelectPage from './pages/GenreSelectPage';
import FeedPage from './pages/FeedPage';
import BookmarksPage from './pages/BookmarksPage';
import CatalogPage from './pages/CatalogPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children, hideNav = false }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/" replace />;
  return <AppLayout hideNav={hideNav}>{children}</AppLayout>;
}

function AppRoutes() {
  const { user } = useApp();

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/genres" replace /> : <AuthPage />}
      />
      <Route
        path="/genres"
        element={
          <ProtectedRoute hideNav>
            <GenreSelectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <BookmarksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <CatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
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
