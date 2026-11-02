import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import AppHeader from './AppHeader.jsx'
import { request } from './api.js'
import './App.css'

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([request('/api/users'), request('/api/organizations')])
      .then(([nextUsers, nextOrganizations]) => {
        if (!active) return
        setUsers(nextUsers)
        setOrganizations(nextOrganizations)
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <Box className="app-shell">
      <AppHeader activeTab="/admin-panel" />
      <Container maxWidth="lg" component="main">
        <Stack spacing={4} className="main-content">
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>
              AIStress · Platform administration
            </Typography>
            <Typography variant="h2" component="h1" fontWeight={800}>
              Users & Organizations
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2, maxWidth: 720 }}>
              Browse accounts, organizations, and roles. Membership and access requests
              are managed by each organization.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {loading && <CircularProgress aria-label="Loading global data" />}
          {!loading && !error && (
            <Box className="form-grid">
              <Card className="status-card">
                <CardContent>
                  <Typography variant="h5" component="h2" fontWeight={700}>
                    Users <Chip size="small" label={users.length} />
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  {users.length ? users.map((user) => (
                    <Box key={user.user_id} className="record-row">
                      <Typography fontWeight={600}>{user.name}</Typography>
                      <Typography color="text.secondary">{user.email}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.role} · {user.is_active ? 'Active' : 'Inactive'}
                        {' · '}
                        {user.org_id ? `Organization ${user.org_id}` : 'No organization'}
                      </Typography>
                    </Box>
                  )) : <Typography color="text.secondary">There are no users yet.</Typography>}
                </CardContent>
              </Card>

              <Card className="status-card">
                <CardContent>
                  <Typography variant="h5" component="h2" fontWeight={700}>
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
                        <Typography key={member.user_id} variant="body2" color="text.secondary">
                          {member.name} · {member.role}
                        </Typography>
                      ))}
                    </Box>
                  )) : <Typography color="text.secondary">There are no organizations yet.</Typography>}
                </CardContent>
              </Card>
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  )
}

export default AdminPanel
