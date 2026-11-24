import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { adminRequest } from './api.js'

const categories = [
  'AUDIO',
  'VIDEO',
  'IMAGE',
  'CONVERSACIONAL',
  'OPEN_SOURCE',
  'ESPECIALIZADO_EN_RAZONAMIENTO',
]
const runtimes = ['OPENAI', 'ANTHROPIC', 'OTHER']
const capabilityOptions = [
  'text',
  'image',
  'audio',
  'video',
  'tools',
  'embeddings',
  'reasoning',
]

function AdminModelsPanel({ adminKey }) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [modelDialog, setModelDialog] = useState(null)
  const [deactivationTarget, setDeactivationTarget] = useState(null)
  const [form, setForm] = useState(emptyExternalModel())

  const loadModels = useCallback(async () => {
    setError('')
    try {
      setModels(await adminRequest('/api/admin/models', adminKey))
    } catch (cause) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadModels, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadModels])

  const saveExternalModel = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (modelDialog?.mode === 'edit') {
        await adminRequest(`/api/admin/models/${modelDialog.model.model_id}`, adminKey, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            version: form.version,
            provider: form.provider,
            category: form.category,
            description: form.description,
            capabilities: form.capabilities,
          }),
        })
      } else {
        await adminRequest('/api/admin/models', adminKey, {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            version: form.version,
            provider: form.provider,
            runtime: form.runtime,
            category: form.category,
            description: form.description,
            capabilities: form.capabilities,
          }),
        })
      }
      setModelDialog(null)
      setMessage('Model saved.')
      await loadModels()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const setModelActive = async (model, isActive) => {
    setBusy(true)
    setError('')
    try {
      await adminRequest(`/api/admin/models/${model.model_id}`, adminKey, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      })
      setMessage(isActive ? 'Model reactivated.' : 'Model deactivated.')
      await loadModels()
      return true
    } catch (cause) {
      setError(cause.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const refreshCatalog = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await loadModels()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const openCreateExternal = () => {
    setForm(emptyExternalModel())
    setModelDialog({ mode: 'create' })
  }

  const openEdit = (model) => {
    setForm({
      name: model.name,
      version: model.version,
      provider: model.provider,
      runtime: model.runtime,
      category: model.category,
      description: model.description ?? '',
      capabilities: model.capabilities ?? [],
    })
    setModelDialog({ mode: 'edit', model })
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="primary" fontWeight={800}>
          AIStress · Platform administration
        </Typography>
        <Typography variant="h3" component="h1" fontWeight={800}>
          AI Models
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Add and manage external provider models for the public catalog.
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="outlined" onClick={openCreateExternal} disabled={busy}>
          Add external model
        </Button>
        <Button onClick={refreshCatalog} disabled={busy}>Refresh catalog</Button>
      </Stack>
      {loading ? (
        <CircularProgress aria-label="Loading model catalog" />
      ) : models.length === 0 ? (
        <Alert severity="info">No models are registered yet.</Alert>
      ) : (
        <Box className="form-grid">
          {models.map((model) => (
            <Card key={model.model_id} className="status-card">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>{model.name}</Typography>
                      <Typography color="text.secondary">
                        {model.provider} · {model.version}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip
                        size="small"
                        color={model.is_active ? 'success' : 'default'}
                        label={model.is_active ? 'Catalog active' : 'Inactive'}
                      />
                    </Stack>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {model.runtime} · {model.category}
                  </Typography>
                  <Typography variant="body2">
                    {model.description || 'No description provided.'}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => openEdit(model)} disabled={busy}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color={model.is_active ? 'error' : 'success'}
                      onClick={() => {
                        if (model.is_active) setDeactivationTarget(model)
                        else setModelActive(model, true)
                      }}
                      disabled={busy}
                    >
                      {model.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(deactivationTarget)}
        onClose={() => {
          if (!busy) setDeactivationTarget(null)
        }}
      >
        <DialogTitle>Deactivate this model?</DialogTitle>
        <DialogContent>
          {deactivationTarget?.name} will be hidden from the public catalog and new evaluations.
          Existing configurations and evaluation history will be preserved.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivationTarget(null)} disabled={busy}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={async () => {
              const succeeded = await setModelActive(deactivationTarget, false)
              if (succeeded) setDeactivationTarget(null)
            }}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(modelDialog)}
        onClose={() => {
          if (!busy) setModelDialog(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={saveExternalModel}>
          <DialogTitle>
            {modelDialog?.mode === 'edit' ? 'Edit model' : 'Add external model'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Model name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
              <TextField
                label="Version"
                value={form.version}
                onChange={(event) => setForm({ ...form, version: event.target.value })}
                required
              />
              <TextField
                label="Provider"
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value })}
                required
              />
              {modelDialog?.mode !== 'edit' && (
                <TextField
                  select
                  label="Runtime"
                  value={form.runtime}
                  onChange={(event) => setForm({ ...form, runtime: event.target.value })}
                >
                  {runtimes.map((runtime) => <MenuItem key={runtime} value={runtime}>{runtime}</MenuItem>)}
                </TextField>
              )}
              <TextField
                select
                label="Category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                required
                disabled={modelDialog?.mode === 'edit' && modelDialog.model.runtime === 'OLLAMA'}
                helperText={modelDialog?.model?.runtime === 'OLLAMA'
                  ? 'Ollama categories are derived from model capabilities.'
                  : undefined}
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
                multiline
                minRows={3}
              />
              {!(modelDialog?.mode === 'edit' && modelDialog.model.runtime === 'OLLAMA') && (
                <FormControl fullWidth>
                  <InputLabel id="model-capabilities-label">Capabilities</InputLabel>
                  <Select
                    labelId="model-capabilities-label"
                    multiple
                    label="Capabilities"
                    value={form.capabilities}
                    onChange={(event) => setForm({
                      ...form,
                      capabilities: event.target.value,
                    })}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {capabilityOptions.map((capability) => (
                      <MenuItem key={capability} value={capability}>{capability}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModelDialog(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Save model
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}

function emptyExternalModel() {
  return {
    name: '',
    version: '',
    provider: '',
    runtime: 'OPENAI',
    category: 'CONVERSACIONAL',
    description: '',
    capabilities: [],
  }
}

export default AdminModelsPanel
