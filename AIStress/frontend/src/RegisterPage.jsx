import { useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
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
import { request } from './api.js'
import { useAuth } from './useAuth.js'
import './AuthPages.css'

function RegisterPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/welcome" replace />

  const submitRegistration = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== passwordConfirmation) {
      setError('Password confirmation does not match.')
      return
    }

    setBusy(true)
    let registrationCompleted = false
    try {
      await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      })
      registrationCompleted = true
      const authenticatedUser = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      signIn(authenticatedUser)
      navigate('/welcome', { replace: true })
    } catch (cause) {
      if (registrationCompleted) {
        navigate('/login', {
          replace: true,
          state: {
            registrationSuccess: true,
            registrationLoginError: cause.message,
          },
        })
      } else {
        setError(cause.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container maxWidth="sm" className="auth-container">
      <Card className="status-card">
        <CardContent>
          <Stack spacing={3} component="form" onSubmit={submitRegistration}>
            <Box>
              <Typography variant="overline" color="primary" fontWeight={800}>AIStress</Typography>
              <Typography variant="h4" component="h1" fontWeight={800}>Create an account</Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              fullWidth
              inputProps={{ maxLength: 120 }}
            />
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              fullWidth
              inputProps={{ minLength: 8, maxLength: 128 }}
              helperText="Use between 8 and 128 characters."
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              fullWidth
              inputProps={{ minLength: 8, maxLength: 128 }}
            />
            <Button type="submit" variant="contained" disabled={busy || loading}>
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Create account'}
            </Button>
            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <RouterLink to="/login">Log in</RouterLink>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  )
}

export default RegisterPage
