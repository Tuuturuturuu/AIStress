import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { AccountIcon } from './AppIcons.jsx'
import { useAuth } from './useAuth.js'

function AppHeader({ apiStatus }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const logout = async () => {
    setError('')
    try {
      await signOut()
      navigate('/welcome', { replace: true })
    } catch (cause) {
      setError(cause.message)
    }
  }

  return (
    <>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar className="toolbar">
          <Typography
            variant="h6"
            component={RouterLink}
            to="/welcome"
            color="inherit"
            fontWeight={800}
            sx={{ textDecoration: 'none' }}
          >
            AIStress
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button component={RouterLink} to="/models" color="inherit">
              Browse Models
            </Button>
            {!user && (
              <>
                <Button component={RouterLink} to="/login" color="inherit">Log in</Button>
                <Button component={RouterLink} to="/sign-in" color="inherit">
                  Sign up
                </Button>
              </>
            )}
            {user && (
              <>
            {apiStatus && (
              <Chip
                label={
                  apiStatus === 'online'
                    ? 'API and PostgreSQL connected'
                    : apiStatus === 'checking'
                      ? 'Connecting…'
                      : 'Service disconnected'
                }
                color={
                  apiStatus === 'online'
                    ? 'success'
                    : apiStatus === 'checking'
                      ? 'default'
                      : 'warning'
                }
                size="small"
                variant="outlined"
              />
            )}
            <Tooltip title="My profile">
              <IconButton
                component={RouterLink}
                to="/profile"
                aria-label="Go to my profile"
                color="inherit"
              >
                <AccountIcon />
              </IconButton>
            </Tooltip>
            <Button onClick={logout} color="inherit">Log out</Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
    </>
  )
}

export default AppHeader
