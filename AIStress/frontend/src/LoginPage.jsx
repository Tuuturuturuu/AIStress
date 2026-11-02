import { useState } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ApiError, request } from './api.js'
import { useAuth } from './useAuth.js'
import './AuthPages.css'

function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/welcome" replace />

  const submitLogin = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const authenticatedUser = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      signIn(authenticatedUser)
      navigate('/welcome', { replace: true })
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? 'The email or password is incorrect.'
          : cause.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container maxWidth="sm" className="auth-container">
      <Card className="status-card">
        <CardContent>
          <Stack spacing={3} component="form" onSubmit={submitLogin}>
            <Box>
              <Typography variant="overline" color="primary" fontWeight={800}>AIStress</Typography>
              <Typography variant="h4" component="h1" fontWeight={800}>Log in</Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={busy || loading}>
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Log in'}
            </Button>
            {location.state?.registrationSuccess && (
              <Alert severity="success">Account created. You can now log in.</Alert>
            )}
            {location.state?.registrationLoginError && (
              <Alert severity="warning">
                Automatic login failed: {location.state.registrationLoginError}
              </Alert>
            )}
            <Typography variant="body2" textAlign="center">
              Don&apos;t have an account?{' '}
              <RouterLink to="/sign-in">Sign up</RouterLink>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  )
}

export default LoginPage
