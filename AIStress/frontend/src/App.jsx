import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail ?? 'No se pudo completar la operación.')
  return data
}

function App() {
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [apiStatus, setApiStatus] = useState('checking')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationDescription, setOrganizationDescription] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedOrganization, setSelectedOrganization] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadData = useCallback(async () => {
    const [nextUsers, nextOrganizations] = await Promise.all([
      request('/api/users'),
      request('/api/organizations'),
    ])
    setUsers(nextUsers)
    setOrganizations(nextOrganizations)
    setApiStatus('online')
  }, [])

  useEffect(() => {
    let isMounted = true
    request('/api/health')
      .then(async (health) => {
        if (!isMounted) return
        if (health.database !== 'connected') {
          setApiStatus('database-offline')
          return
        }
        const [nextUsers, nextOrganizations] = await Promise.all([
          request('/api/users'),
          request('/api/organizations'),
        ])
        if (isMounted) {
          setUsers(nextUsers)
          setOrganizations(nextOrganizations)
          setApiStatus('online')
        }
      })
      .catch((cause) => {
        if (isMounted) {
          setApiStatus('offline')
          setError(cause.message)
        }
      })
    return () => { isMounted = false }
  }, [])

  const runAction = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await loadData()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const createUser = (event) => {
    event.preventDefault()
    runAction(async () => {
      await request('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: userName, email: userEmail }),
      })
      setUserName('')
      setUserEmail('')
    })
  }

  const createOrganization = (event) => {
    event.preventDefault()
    runAction(async () => {
      await request('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: organizationName, description: organizationDescription || null }),
      })
      setOrganizationName('')
      setOrganizationDescription('')
    })
  }

  const addMember = (event) => {
    event.preventDefault()
    runAction(async () => {
      await request(`/api/organizations/${selectedOrganization}/members/${selectedUser}`, { method: 'POST' })
    })
  }

  return (
    <Box className="app-shell">
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar className="toolbar">
          <Typography variant="h6" component="div" fontWeight={800}>AIStress</Typography>
          <Chip
            label={apiStatus === 'online' ? 'API y PostgreSQL conectados' : apiStatus === 'checking' ? 'Conectando…' : 'Servicio desconectado'}
            color={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'default' : 'warning'}
            size="small"
            variant="outlined"
          />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" component="main">
        <Stack spacing={4} className="main-content">
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>React · Material UI · FastAPI · PostgreSQL</Typography>
            <Typography variant="h2" component="h1" fontWeight={800}>Usuarios y organizaciones</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2, maxWidth: 720 }}>
              Crea usuarios, organiza equipos y administra sus membresías.
            </Typography>
          </Box>

          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {apiStatus === 'offline' && <Alert severity="warning">No se pudo cargar la API. Comprueba que FastAPI y PostgreSQL estén activos.</Alert>}
          {apiStatus === 'database-offline' && <Alert severity="warning">La API responde, pero no hay conexión con PostgreSQL.</Alert>}

          <Box className="form-grid">
            <Card className="status-card">
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={700}>Añadir usuario</Typography>
                <Box component="form" onSubmit={createUser} className="form-stack">
                  <TextField label="Nombre" value={userName} onChange={(event) => setUserName(event.target.value)} required inputProps={{ maxLength: 120 }} />
                  <TextField label="Correo electrónico" type="email" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} required inputProps={{ maxLength: 320 }} />
                  <Button type="submit" variant="contained" disabled={busy || apiStatus !== 'online'}>Crear usuario</Button>
                </Box>
              </CardContent>
            </Card>

            <Card className="status-card">
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={700}>Añadir organización</Typography>
                <Box component="form" onSubmit={createOrganization} className="form-stack">
                  <TextField label="Nombre de la organización" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required inputProps={{ maxLength: 160 }} />
                  <TextField label="Descripción (opcional)" value={organizationDescription} onChange={(event) => setOrganizationDescription(event.target.value)} multiline minRows={1} inputProps={{ maxLength: 500 }} />
                  <Button type="submit" variant="contained" disabled={busy || apiStatus !== 'online'}>Crear organización</Button>
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Card className="status-card">
            <CardContent>
              <Typography variant="h5" component="h2" fontWeight={700}>Asignar usuario a organización</Typography>
              <Box component="form" onSubmit={addMember} className="membership-form">
                <TextField select label="Usuario" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} required>
                  {users.map((user) => <MenuItem key={user.id} value={user.id}>{user.name} · {user.email}</MenuItem>)}
                </TextField>
                <TextField select label="Organización" value={selectedOrganization} onChange={(event) => setSelectedOrganization(event.target.value)} required>
                  {organizations.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}
                </TextField>
                <Button type="submit" variant="outlined" disabled={busy || apiStatus !== 'online' || !users.length || !organizations.length}>Asignar</Button>
              </Box>
            </CardContent>
          </Card>

          <Box className="form-grid">
            <Card className="status-card">
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={700}>Usuarios <Chip size="small" label={users.length} /></Typography>
                <Divider sx={{ my: 2 }} />
                {users.length ? users.map((user) => (
                  <Box key={user.id} className="record-row">
                    <Typography fontWeight={600}>{user.name}</Typography>
                    <Typography color="text.secondary">{user.email}</Typography>
                  </Box>
                )) : <Typography color="text.secondary">Aún no hay usuarios.</Typography>}
              </CardContent>
            </Card>
            <Card className="status-card">
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={700}>Organizaciones <Chip size="small" label={organizations.length} /></Typography>
                <Divider sx={{ my: 2 }} />
                {organizations.length ? organizations.map((organization) => (
                  <Box key={organization.id} className="record-row">
                    <Typography fontWeight={600}>{organization.name}</Typography>
                    <Typography color="text.secondary">{organization.description || 'Sin descripción'} · {organization.members.length} miembros</Typography>
                    {organization.members.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {organization.members.map((member) => member.name).join(', ')}
                      </Typography>
                    )}
                  </Box>
                )) : <Typography color="text.secondary">Aún no hay organizaciones.</Typography>}
              </CardContent>
            </Card>
          </Box>
          {busy && <CircularProgress size={24} sx={{ alignSelf: 'center' }} />}
        </Stack>
      </Container>
    </Box>
  )
}

export default App
