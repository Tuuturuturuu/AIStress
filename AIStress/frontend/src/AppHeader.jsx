import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { AccountIcon } from './AppIcons.jsx'
import { useAuth } from './useAuth.js'

function AppHeader({ activeTab, apiStatus }) {
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

  if (!user) return null

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
          {user?.role === 'ADMIN' && (
            <Tabs value={activeTab ?? false} aria-label="Administration navigation">
              <Tab
                label="Users & Organizations"
                value="/admin-panel"
                component={RouterLink}
                to="/admin-panel"
              />
            </Tabs>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          </Box>
        </Toolbar>
      </AppBar>
    </>
  )
}

export default AppHeader
