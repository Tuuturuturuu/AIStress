import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AppHeader from './AppHeader.jsx'
import { request } from './api.js'
import { useAuth } from './useAuth.js'
import './ModelsPage.css'

const categoryLabels = {
  AUDIO: 'Audio',
  VIDEO: 'Video',
  IMAGE: 'Image',
  CONVERSACIONAL: 'Conversational',
  OPEN_SOURCE: 'Open source',
  ESPECIALIZADO_EN_RAZONAMIENTO: 'Reasoning',
}

function ModelsPage() {
  const { user, loading: authLoading } = useAuth()
  const [models, setModels] = useState([])
  const [statusByModel, setStatusByModel] = useState({})
  const [serverAvailable, setServerAvailable] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [category, setCategory] = useState('')
  const [family, setFamily] = useState('')
  const [parameterSize, setParameterSize] = useState('')
  const [modelFormat, setModelFormat] = useState('')
  const [capability, setCapability] = useState('')
  const [sort, setSort] = useState('name')
  const [view, setView] = useState(1)
  const [selectedModel, setSelectedModel] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (provider) params.set('provider', provider)
    if (category) params.set('category', category)
    if (family) params.set('family', family)
    if (parameterSize) params.set('parameter_size', parameterSize)
    if (modelFormat) params.set('model_format', modelFormat)
    if (capability) params.set('capability', capability)
    params.set('sort', sort)
    return params.toString()
  }, [search, provider, category, family, parameterSize, modelFormat, capability, sort])

  const loadModels = useCallback(async () => {
    setError('')
    try {
      const result = await request(`/api/models?${query}`)
      setModels(result)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }, [query])

  const refreshOllamaStatus = useCallback(async () => {
    if (!user || authLoading) return
    setRefreshing(true)
    setStatusError('')
    try {
      const result = await request('/api/models/status/ollama')
      setServerAvailable(result.server_available)
      setStatusError(result.error ?? '')
      setStatusByModel(
        result.server_available
          ? Object.fromEntries(result.models.map((item) => [item.model_id, item.available]))
          : {},
      )
    } catch (cause) {
      setServerAvailable(false)
      setStatusByModel({})
      setStatusError(cause.message)
    } finally {
      setRefreshing(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadModels, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadModels])

  useEffect(() => {
    if (!user || authLoading) return undefined
    const initialTimeoutId = window.setTimeout(refreshOllamaStatus, 0)
    const intervalId = window.setInterval(refreshOllamaStatus, 60_000)
    return () => {
      window.clearTimeout(initialTimeoutId)
      window.clearInterval(intervalId)
    }
  }, [user, authLoading, refreshOllamaStatus])

  const providers = [...new Set(models.map((item) => item.provider).filter(Boolean))].sort()
  const categories = [...new Set(models.map((item) => item.category).filter(Boolean))].sort()
  const families = [...new Set(models.map((item) => item.family).filter(Boolean))].sort()
  const parameterSizes = [...new Set(models.map((item) => item.parameter_size).filter(Boolean))].sort()
  const formats = [...new Set(models.map((item) => item.model_format).filter(Boolean))].sort()
  const capabilities = [
    ...new Set(models.flatMap((item) => item.capabilities ?? [])),
  ].sort()

  return (
    <Box className="app-shell">
      <AppHeader />
      <Container maxWidth="xl" component="main" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>
              AIStress · Model catalog
            </Typography>
            <Typography variant="h2" component="h1" fontWeight={800}>
              AI Models
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
              Browse active models and compare their providers, capabilities, and technical details.
            </Typography>
          </Box>

          <Box className="models-search-row">
            <TextField
              label="Search name, provider, or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              size="small"
              className="models-search-field"
            />
          </Box>

          {user && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Chip
                label={
                  serverAvailable === null
                    ? 'Checking Ollama…'
                    : serverAvailable
                      ? 'Ollama server connected'
                      : 'Ollama server unavailable'
                }
                color={
                  serverAvailable === null
                    ? 'default'
                    : serverAvailable
                      ? 'success'
                      : 'error'
                }
                variant="outlined"
              />
              <Button onClick={refreshOllamaStatus} disabled={refreshing}>
                {refreshing ? <CircularProgress size={18} /> : 'Refresh status'}
              </Button>
              {statusError && <Typography variant="body2" color="error">{statusError}</Typography>}
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          <Box className="models-catalog-layout">
            <Card className="status-card models-filter-panel">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={700}>Filter models</Typography>
                  <FilterSelect
                    label="Provider / family"
                    value={provider}
                    options={providers}
                    onChange={setProvider}
                  />
                  <FilterSelect
                    label="Category"
                    value={category}
                    options={categories}
                    labels={categoryLabels}
                    onChange={setCategory}
                  />
                  <FilterSelect
                    label="Family"
                    value={family}
                    options={families}
                    onChange={setFamily}
                  />
                  <FilterSelect
                    label="Parameter size"
                    value={parameterSize}
                    options={parameterSizes}
                    onChange={setParameterSize}
                  />
                  <FilterSelect
                    label="Format"
                    value={modelFormat}
                    options={formats}
                    onChange={setModelFormat}
                  />
                  <FilterSelect
                    label="Capability"
                    value={capability}
                    options={capabilities}
                    onChange={setCapability}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel id="model-sort-label">Sort by</InputLabel>
                    <Select
                      labelId="model-sort-label"
                      label="Sort by"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <MenuItem value="name">Name</MenuItem>
                      <MenuItem value="provider">Provider</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    onClick={() => {
                      setProvider('')
                      setCategory('')
                      setFamily('')
                      setParameterSize('')
                      setModelFormat('')
                      setCapability('')
                      setSearch('')
                    }}
                  >
                    Clear filters
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">
                  {models.length} active {models.length === 1 ? 'model' : 'models'}
                </Typography>
                <Tabs value={view} onChange={(_, value) => setView(value)} aria-label="Model display">
                  <Tab label="Cards" />
                  <Tab label="Table" />
                </Tabs>
              </Stack>
              {loading ? (
                <CircularProgress aria-label="Loading models" />
              ) : models.length === 0 ? (
                <Alert severity="info">
                  No active models match your filters. The catalog may not have been populated yet.
                </Alert>
              ) : view === 0 ? (
                <Box className="models-card-grid">
                  {models.map((model) => (
                    <ModelCard
                      key={model.model_id}
                      model={model}
                      status={statusByModel[model.model_id]}
                      showStatus={Boolean(user) && model.runtime === 'OLLAMA'}
                      onOpen={() => setSelectedModel(model)}
                    />
                  ))}
                </Box>
              ) : (
                <ModelTable
                  models={models}
                  statusByModel={statusByModel}
                  showStatus={Boolean(user)}
                  onOpen={setSelectedModel}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>
      <Drawer
        anchor="right"
        open={Boolean(selectedModel)}
        onClose={() => setSelectedModel(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', md: '33.333vw' },
            maxWidth: 'none',
            p: 0,
            bgcolor: 'background.default',
            boxSizing: 'border-box',
            overflowX: 'hidden',
          },
        }}
      >
        {selectedModel && (
          <Box className="model-details-drawer">
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="overline" color="primary" fontWeight={800}>
                    Model details
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setSelectedModel(null)}
                    aria-label="Close model details"
                  >
                    Close
                  </Button>
                </Stack>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, overflowWrap: 'anywhere' }}
                >
                  {selectedModel.name}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  label={selectedModel.provider}
                  sx={{ bgcolor: '#e0f2f1', color: '#00695c', fontWeight: 700 }}
                />
                <Chip
                  label={categoryLabels[selectedModel.category] ?? selectedModel.category}
                  sx={{ bgcolor: '#ede7f6', color: '#4527a0', fontWeight: 700 }}
                />
              </Stack>
              {user && selectedModel.runtime === 'OLLAMA' && (
                <Chip
                  label={
                    statusByModel[selectedModel.model_id] === undefined
                      ? 'Status not checked'
                      : statusByModel[selectedModel.model_id]
                        ? 'Available in Ollama'
                        : 'Unavailable in Ollama'
                  }
                  color={statusByModel[selectedModel.model_id] ? 'success' : 'warning'}
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              {user && selectedModel.runtime === 'OLLAMA' && (
                statusError ? (
                  <Alert severity="error">{statusError}</Alert>
                ) : statusByModel[selectedModel.model_id] === false ? (
                  <Alert severity="warning">
                    This model is not currently installed on the configured Ollama server.
                  </Alert>
                ) : null
              )}
              <Box className="model-details-section">
                <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={1}>
                  DESCRIPTION
                </Typography>
                <Typography sx={{ lineHeight: 1.7 }}>
                  {selectedModel.description || 'No description provided.'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} mb={1.5}>
                  Technical details
                </Typography>
                <Stack spacing={1}>
                  <Detail label="Version" value={selectedModel.version} />
                  <Detail label="Runtime" value={selectedModel.runtime} />
                  <Detail label="Family" value={selectedModel.family} />
                  <Detail label="Parameter size" value={selectedModel.parameter_size} />
                  <Detail label="Format" value={selectedModel.model_format} />
                  <Detail label="Quantization" value={selectedModel.quantization} />
                </Stack>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={1}>
                  CAPABILITIES
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {(selectedModel.capabilities ?? []).map((item) => (
                    <Chip
                      key={item}
                      size="small"
                      label={item}
                      sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  )
}

function FilterSelect({ label, value, options, onChange, labels = {} }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <MenuItem value="">All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>{labels[option] ?? option}</MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function ModelCard({ model, status, showStatus, onOpen, compact = false }) {
  return (
    <Card
      className="status-card"
      variant="outlined"
      sx={{ cursor: 'pointer' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen()
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant={compact ? 'h6' : 'h5'} fontWeight={700}>
                {model.name}
              </Typography>
            </Box>
            {showStatus && (
              <Chip
                size="small"
                color={status === undefined ? 'default' : status ? 'success' : 'warning'}
                label={status === undefined ? 'Unknown' : status ? 'Available' : 'Unavailable'}
              />
            )}
          </Stack>
          {!compact && (
            <Typography color="text.secondary">
              {model.description || 'No description provided.'}
            </Typography>
          )}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              label={categoryLabels[model.category] ?? model.category}
              sx={{ bgcolor: '#ede7f6', color: '#4527a0', fontWeight: 600 }}
            />
            <Chip
              size="small"
              label={model.provider}
              sx={{ bgcolor: '#e0f2f1', color: '#00695c', fontWeight: 600 }}
            />
            {model.parameter_size && (
              <Chip
                size="small"
                label={model.parameter_size}
                sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }}
              />
            )}
            {(model.capabilities ?? []).map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={tag}
                sx={{ bgcolor: '#e3f2fd', color: '#1565c0' }}
              />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function ModelTable({ models, statusByModel, showStatus, onOpen }) {
  return (
    <TableContainer component={Card} className="status-card">
      <Table size="small" aria-label="AI model catalog">
        <TableHead>
          <TableRow>
            <TableCell>Model</TableCell>
            <TableCell>Provider</TableCell>
            <TableCell>Management</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Parameters</TableCell>
            {showStatus && <TableCell>Connection</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {models.map((model) => (
            <TableRow
              key={model.model_id}
              hover
              tabIndex={0}
              sx={{ cursor: 'pointer' }}
              onClick={() => onOpen(model)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpen(model)
              }}
            >
              <TableCell>
                <Typography fontWeight={700}>{model.name}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={model.provider}
                  sx={{ bgcolor: '#e0f2f1', color: '#00695c', fontWeight: 600 }}
                />
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={model.runtime === 'OLLAMA' ? 'Ollama' : 'External'}
                  color={model.runtime === 'OLLAMA' ? 'primary' : 'default'}
                />
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={categoryLabels[model.category] ?? model.category}
                  sx={{ bgcolor: '#ede7f6', color: '#4527a0', fontWeight: 600 }}
                />
              </TableCell>
              <TableCell>
                {model.parameter_size ? (
                  <Chip
                    size="small"
                    label={model.parameter_size}
                    sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }}
                  />
                ) : '—'}
              </TableCell>
              {showStatus && (
                <TableCell>
                  {model.runtime === 'OLLAMA' ? (
                    <Chip
                      size="small"
                      color={
                        statusByModel[model.model_id] === undefined
                          ? 'default'
                          : statusByModel[model.model_id]
                            ? 'success'
                            : 'warning'
                      }
                      label={
                        statusByModel[model.model_id] === undefined
                          ? 'Unknown'
                          : statusByModel[model.model_id]
                            ? 'Available'
                            : 'Unavailable'
                      }
                    />
                  ) : '—'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={600} textAlign="right" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  )
}

export default ModelsPage
