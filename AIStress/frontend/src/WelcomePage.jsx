import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import {
  AssessmentIcon,
  PsychologyIcon,
  SecurityIcon,
  SparklesIcon,
} from './AppIcons.jsx'
import AppHeader from './AppHeader.jsx'
import { useAuth } from './useAuth.js'
import './AuthPages.css'

const previews = [
  {
    title: 'Comparable evaluations',
    description: 'Organize tests and analyze responses from different models in one place.',
    icon: AssessmentIcon,
    metric: '12',
    metricLabel: 'available tests',
    bars: [42, 68, 54, 86, 62, 78],
  },
  {
    title: 'Analysis dimensions',
    description: 'Explore bias, hallucinations, memory, attention, and linguistic robustness.',
    icon: PsychologyIcon,
    metric: '6',
    metricLabel: 'initial dimensions',
    bars: [76, 48, 88, 59, 70, 42],
  },
  {
    title: 'Clear results',
    description: 'Review scores and responses to understand how each model behaves.',
    icon: SecurityIcon,
    metric: '100%',
    metricLabel: 'organized results',
    bars: [55, 80, 46, 72, 90, 64],
  },
]

function WelcomePage() {
  const { user, loading } = useAuth()
  const [selectedPreview, setSelectedPreview] = useState(0)
  const preview = previews[selectedPreview]
  const PreviewIcon = preview.icon

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" component="main" className="welcome-container">
        <Stack spacing={{ xs: 6, md: 9 }} alignItems="center">
          <Box component="section" className="welcome-hero">
            <Typography variant="overline" color="primary" fontWeight={800}>
              RESPONSIBLE AI EVALUATION
            </Typography>
            <Typography variant="h1" className="welcome-title">
              Understand how AI models respond
            </Typography>
            <Typography variant="h6" color="text.secondary" maxWidth={740}>
              AIStress brings tests, dimensions, and results together to explore model behavior
              clearly and consistently.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ mt: 2 }}
            >
              {loading ? (
                <CircularProgress aria-label="Checking session" />
              ) : user ? (
                <>
                  <Button
                    component={RouterLink}
                    to="/profile"
                    variant="contained"
                    size="large"
                  >
                    View my profile
                  </Button>
                  <Button
                    component="a"
                    href="#explore"
                    variant="outlined"
                    size="large"
                    startIcon={<SparklesIcon />}
                  >
                    Explore the platform
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    component={RouterLink}
                    to="/login"
                    variant="contained"
                    size="large"
                  >
                    Log in
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/sign-in"
                    variant="outlined"
                    size="large"
                  >
                    Sign up
                  </Button>
                </>
              )}
            </Stack>
          </Box>

          <Box component="section" id="explore" className="welcome-preview">
            <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 3 }}>
              <Typography variant="h4" component="h2" fontWeight={800}>
                An AIStress preview
              </Typography>
              <Typography color="text.secondary">
                Select an area to preview the platform.
              </Typography>
            </Stack>
            <Box className="preview-selector" role="group" aria-label="Platform areas">
              {previews.map((item, index) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.title}
                    variant={selectedPreview === index ? 'contained' : 'outlined'}
                    startIcon={<Icon />}
                    onClick={() => setSelectedPreview(index)}
                    aria-pressed={selectedPreview === index}
                  >
                    {item.title}
                  </Button>
                )
              })}
            </Box>
            <Card className="preview-card" elevation={0}>
              <CardContent className="preview-card-content">
                <Box className="preview-copy">
                  <Box className="preview-icon">
                    <PreviewIcon color="primary" fontSize="large" />
                  </Box>
                  <Typography variant="h5" component="h3" fontWeight={800}>
                    {preview.title}
                  </Typography>
                  <Typography color="text.secondary">{preview.description}</Typography>
                  <Typography variant="h3" color="primary" fontWeight={800} sx={{ mt: 2 }}>
                    {preview.metric}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {preview.metricLabel}
                  </Typography>
                </Box>
                <Box
                  className="preview-visual"
                  role="img"
                  aria-label={`Illustrative chart for ${preview.title}`}
                >
                  <Box className="preview-visual-heading">
                    <Typography variant="subtitle1" fontWeight={700}>Evaluation dashboard</Typography>
                    <Typography variant="caption" color="text.secondary">Illustrative preview</Typography>
                  </Box>
                  <Box className="preview-chart">
                    {preview.bars.map((height, index) => (
                      <Box
                        key={`${selectedPreview}-${index}`}
                        className="preview-bar"
                        sx={{ height: `${height}%` }}
                      />
                    ))}
                  </Box>
                  <Box className="preview-legend">
                    <span />
                    <Typography variant="caption" color="text.secondary">
                      Indicators by dimension
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </Container>
    </>
  )
}

export default WelcomePage
