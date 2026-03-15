import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import AppLayout from './components/AppLayout'
import AdminCommentsPage from './pages/AdminCommentsPage'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import BookmarksPage from './pages/BookmarksPage'
import CatalogPage from './pages/CatalogPage'
import FeedPage from './pages/FeedPage'
import GenreSelectPage from './pages/GenreSelectPage'
import ProfilePage from './pages/ProfilePage'

function getDefaultAuthorizedPath(hasCompletedOnboarding) {
  return hasCompletedOnboarding ? '/feed' : '/genres'
}

function AuthOnlyRoute({ children }) {
  const { user, hasCompletedOnboarding, authStatus } = useApp()

  if (authStatus === 'checking' && !user) {
    return children
  }

  if (user) {
    return <Navigate to={getDefaultAuthorizedPath(hasCompletedOnboarding)} replace />
  }

  return children
}

function ProtectedRoute({
  children,
  hideNav = false,
  requireOnboarding = false,
  requireAdmin = false,
}) {
  const { user, hasCompletedOnboarding, authStatus } = useApp()

  if (authStatus === 'checking') {
    return null
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!hasCompletedOnboarding && requireOnboarding) {
    return <Navigate to="/genres" replace />
  }

  if (hasCompletedOnboarding && hideNav) {
    return <Navigate to="/feed" replace />
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/feed" replace />
  }

  return <AppLayout hideNav={hideNav}>{children}</AppLayout>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthOnlyRoute>
            <AuthPage />
          </AuthOnlyRoute>
        }
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
      <Route
        path="/admin/comments"
        element={
          <ProtectedRoute requireOnboarding requireAdmin>
            <AdminCommentsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
