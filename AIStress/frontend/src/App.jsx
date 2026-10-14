import { useEffect, useState } from 'react'
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
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [apiStatus, setApiStatus] = useState('checking')

  const checkApi = async () => {
    setApiStatus('checking')
    try {
      const response = await fetch(`${API_URL}/api/health`)
      if (!response.ok) throw new Error('API health check failed')
      setApiStatus('online')
    } catch {
      setApiStatus('offline')
    }
  }

  useEffect(() => {
    let isMounted = true
    fetch(`${API_URL}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error('API health check failed')
        if (isMounted) setApiStatus('online')
      })
      .catch(() => {
        if (isMounted) setApiStatus('offline')
      })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Box className="app-shell">
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar className="toolbar">
          <Typography variant="h6" component="div" fontWeight={800}>AIStress</Typography>
          <Chip label="Starter workspace" size="small" variant="outlined" />
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" component="main">
        <Stack spacing={4} className="main-content">
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>
              React · Material UI · FastAPI
            </Typography>
            <Typography variant="h2" component="h1" fontWeight={800}>
              Tu aplicación empieza aquí.
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mt: 2, maxWidth: 680 }}
            >
              Una base sencilla para construir una experiencia web moderna y conectarla
              con tu backend en Python.
            </Typography>
          </Box>
          <Card className="status-card">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h5" component="h2" fontWeight={700}>
                    Estado del backend
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Comprobación del endpoint de salud de FastAPI.
                  </Typography>
                </Box>
                <Button variant="contained" onClick={checkApi} disabled={apiStatus === 'checking'}>
                  {apiStatus === 'checking' ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : 'Comprobar conexión'}
                </Button>
              </Stack>
              {apiStatus === 'online' && (
                <Alert severity="success" sx={{ mt: 3 }}>
                  Backend conectado correctamente.
                </Alert>
              )}
              {apiStatus === 'offline' && (
                <Alert severity="warning" sx={{ mt: 3 }}>
                  No se pudo conectar. Inicia el backend en http://localhost:8000.
                </Alert>
              )}
              {apiStatus === 'checking' && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Conectando con la API…
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}

export default App
