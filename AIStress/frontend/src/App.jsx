import { lazy, Suspense } from 'react'
import { Alert, Box, Button, CircularProgress, Container } from '@mui/material'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext.jsx'
import { useAuth } from './useAuth.js'

const AdminPanel = lazy(() => import('./AdminPanel.jsx'))
const LoginPage = lazy(() => import('./LoginPage.jsx'))
const ProfilePage = lazy(() => import('./ProfilePage.jsx'))
const RegisterPage = lazy(() => import('./RegisterPage.jsx'))
const WelcomePage = lazy(() => import('./WelcomePage.jsx'))

function RequireUser({ adminOnly = false }) {
  const { user, loading, error, refreshUser } = useAuth()

  if (loading) {
    return <CircularProgress aria-label="Checking session" sx={{ m: 4 }} />
  }
  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 6 }}>
        <Alert
          severity="error"
          action={<Button color="inherit" onClick={refreshUser}>Retry</Button>}
        >
          Could not verify your session: {error}
        </Alert>
      </Container>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/welcome" replace />
  return <Outlet />
}

function AppRoutes() {
  return (
    <Suspense fallback={<CircularProgress aria-label="Loading page" sx={{ m: 4 }} />}>
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign-in" element={<RegisterPage />} />
        <Route element={<RequireUser />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route element={<RequireUser adminOnly />}>
          <Route path="/admin-panel" element={<AdminPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Box className="app-shell">
          <AppRoutes />
        </Box>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
