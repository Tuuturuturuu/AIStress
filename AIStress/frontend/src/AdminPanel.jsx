import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AppHeader from './AppHeader.jsx'
import AdminModelsPanel from './AdminModelsPanel.jsx'
import { adminRequest } from './api.js'
import { useAuth } from './useAuth.js'
import './App.css'

function AdminPanel() {
  const { user } = useAuth()
  const [adminKey, setAdminKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const hasAdminSession = user?.role === 'ADMIN'
  const hasAccess = hasAdminSession || Boolean(adminKey)

  useEffect(() => {
    if (!hasAccess) return undefined

    let active = true
    const loadAdministrationData = async () => {
      setLoading(true)
      setError('')
      try {
        const [nextUsers, nextOrganizations] = await Promise.all([
          adminRequest('/api/users', adminKey),
          adminRequest('/api/organizations', adminKey),
        ])
        if (!active) return
        setUsers(nextUsers)
        setOrganizations(nextOrganizations)
      } catch (cause) {
        if (active) setError(cause.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAdministrationData()
    return () => { active = false }
  }, [adminKey, hasAccess])

  const unlockPanel = async (event) => {
    event.preventDefault()
    setError('')
    const candidateKey = keyInput.trim()
    try {
      await adminRequest('/api/users', candidateKey)
      setAdminKey(candidateKey)
      setKeyInput('')
    } catch (cause) {
      setError(cause.message)
    }
  }

  return (
    <Box className="app-shell">
      <AppHeader />
      <Container maxWidth="lg" component="main">
        <Stack spacing={4} className="main-content">
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>
              AIStress · Platform administration
            </Typography>
            <Typography variant="h2" component="h1" fontWeight={800}>
              Admin Panel
            </Typography>
          </Box>

          {!hasAccess && (
            <Card className="status-card">
              <CardContent>
                <Stack spacing={2} component="form" onSubmit={unlockPanel}>
                  <Typography variant="h6" fontWeight={700}>
                    Enter the admin key
                  </Typography>
                  <Typography color="text.secondary">
                    This panel does not require a regular user account. The admin key is kept only
                    in memory for this page visit.
                  </Typography>
                  <TextField
                    label="Admin key"
                    type="password"
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" disabled={!keyInput.trim()}>
                    Open Admin Panel
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {hasAccess && (
            <>
              {error && <Alert severity="error">{error}</Alert>}
              <Tabs
                value={activeSection}
                onChange={(_, value) => setActiveSection(value)}
                aria-label="Administration sections"
              >
                <Tab label="Users & Organizations" />
                <Tab label="AI Models" />
              </Tabs>
              {activeSection === 1 ? (
                <AdminModelsPanel adminKey={adminKey} />
              ) : (
                <>
                  <Box>
                    <Typography variant="h4" component="h2" fontWeight={800}>
                      Users & Organizations
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
                      Browse accounts, organizations, and roles. Membership and access requests
                      are managed by each organization.
                    </Typography>
                  </Box>
                  {loading && <CircularProgress aria-label="Loading global data" />}
                  {!loading && !error && (
                    <Box className="form-grid">
                      <Card className="status-card">
                        <CardContent>
                          <Typography variant="h5" component="h3" fontWeight={700}>
                            Users <Chip size="small" label={users.length} />
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          {users.length ? users.map((adminUser) => (
                            <Box key={adminUser.user_id} className="record-row">
                              <Typography fontWeight={600}>{adminUser.name}</Typography>
                              <Typography color="text.secondary">{adminUser.email}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {adminUser.role} · {adminUser.is_active ? 'Active' : 'Inactive'}
                                {' · '}
                                {adminUser.org_id
                                  ? `Organization ${adminUser.org_id}`
                                  : 'No organization'}
                              </Typography>
                            </Box>
                          )) : (
                            <Typography color="text.secondary">There are no users yet.</Typography>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="status-card">
                        <CardContent>
                          <Typography variant="h5" component="h3" fontWeight={700}>
                            Organizations <Chip size="small" label={organizations.length} />
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          {organizations.length ? organizations.map((organization) => (
                            <Box key={organization.org_id} className="record-row">
                              <Typography fontWeight={600}>{organization.name}</Typography>
                              <Typography color="text.secondary">
                                {organization.is_active ? 'Active' : 'Inactive'}
                                {' · '}
                                {organization.members.length} members
                              </Typography>
                              {organization.members.map((member) => (
                                <Typography
                                  key={member.user_id}
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {member.name} · {member.role}
                                </Typography>
                              ))}
                            </Box>
                          )) : (
                            <Typography color="text.secondary">
                              There are no organizations yet.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  )
}

export default AdminPanel
