import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import AppLayout from './components/AppLayout'
import AuthPage from './pages/AuthPage'
import GenreSelectPage from './pages/GenreSelectPage'
import FeedPage from './pages/FeedPage'
import BookmarksPage from './pages/BookmarksPage'
import CatalogPage from './pages/CatalogPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminCommentsPage from './pages/AdminCommentsPage'

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

  const userRole = user?.role || (user?.isAdmin ? 'admin' : 'user')

  if (requireAdmin && userRole !== 'admin') {
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
