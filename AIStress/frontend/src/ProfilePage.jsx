import { useCallback, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AppHeader from './AppHeader.jsx'
import { apiUrl, request } from './api.js'
import { useAuth } from './useAuth.js'
import { useNavigate } from 'react-router-dom'
import './ProfilePage.css'

const profileTabs = ['Account', 'Organization', 'Accessibility', 'Privacy Data']

function ProfilePage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [accountMessage, setAccountMessage] = useState(null)
  const [accountBusy, setAccountBusy] = useState(false)
  const [deactivationOpen, setDeactivationOpen] = useState(false)
  const [deactivationPassword, setDeactivationPassword] = useState('')
  const [deactivationError, setDeactivationError] = useState('')

  const [organization, setOrganization] = useState(null)
  const [organizationRequests, setOrganizationRequests] = useState([])
  const [organizationError, setOrganizationError] = useState('')
  const [organizationMessage, setOrganizationMessage] = useState('')
  const [organizationLoading, setOrganizationLoading] = useState(false)
  const [organizationBusy, setOrganizationBusy] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [organizationName, setOrganizationName] = useState('')
  const [organizationDescription, setOrganizationDescription] = useState('')
  const [organizationAddress, setOrganizationAddress] = useState('')
  const [organizationLogo, setOrganizationLogo] = useState(null)

  const deactivateAccount = async () => {
    setAccountBusy(true)
    setDeactivationError('')
    try {
      await request('/api/profile/account', {
        method: 'DELETE',
        body: JSON.stringify({ current_password: deactivationPassword }),
      })
      signIn(null)
      navigate('/welcome', { replace: true })
    } catch (cause) {
      setDeactivationError(cause.message)
    } finally {
      setAccountBusy(false)
    }
  }

  const loadOrganization = useCallback(async () => {
    setOrganizationLoading(true)
    setOrganizationError('')
    try {
      const [nextOrganization, nextRequests] = await Promise.all([
        request('/api/profile/organization'),
        request('/api/profile/organization/requests'),
      ])
      setOrganization(nextOrganization)
      setOrganizationRequests(nextRequests)
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationLoading(false)
    }
  }, [])

  const saveAccount = async (event) => {
    event.preventDefault()
    setAccountMessage(null)
    if (newPassword && newPassword !== passwordConfirmation) {
      setAccountMessage({
        severity: 'error',
        text: 'Password confirmation does not match.',
      })
      return
    }
    if (newPassword && newPassword.length < 8) {
      setAccountMessage({
        severity: 'error',
        text: 'The new password must be at least 8 characters long.',
      })
      return
    }

    setAccountBusy(true)
    try {
      const updatedUser = await request('/api/profile/account', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          email,
          ...(newPassword && {
            current_password: currentPassword,
            new_password: newPassword,
            new_password_confirmation: passwordConfirmation,
          }),
        }),
      })
      signIn(updatedUser)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirmation('')
      setAccountMessage({ severity: 'success', text: 'Your account details have been updated.' })
    } catch (cause) {
      setAccountMessage({ severity: 'error', text: cause.message })
    } finally {
      setAccountBusy(false)
    }
  }

  const searchOrganizations = async (event) => {
    event.preventDefault()
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      const results = await request(
        `/api/profile/organization/search?q=${encodeURIComponent(searchText.trim())}`,
      )
      setSearchResults(results)
      setSearchPerformed(true)
    } catch (cause) {
      setOrganizationError(cause.message)
    }
  }

  const requestMembership = async (organizationId) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      const createdRequest = await request(
        `/api/profile/organization/requests/${organizationId}`,
        { method: 'POST' },
      )
      setOrganizationRequests((previous) => [createdRequest, ...previous])
      setOrganizationMessage('Request sent. A manager must approve it before you can join.')
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  const createOrganization = async (event) => {
    event.preventDefault()
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    const formData = new FormData()
    formData.set('name', organizationName)
    formData.set('description', organizationDescription)
    formData.set('address', organizationAddress)
    if (organizationLogo) formData.set('logo', organizationLogo)

    try {
      const createdOrganization = await request('/api/profile/organization', {
        method: 'POST',
        body: formData,
      })
      setOrganization(createdOrganization)
      setOrganizationName('')
      setOrganizationDescription('')
      setOrganizationAddress('')
      setOrganizationLogo(null)
      signIn(await request('/api/auth/me'))
      setOrganizationMessage('Organization created. You are now a manager.')
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  const decideRequest = async (requestId, decision) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/requests/${requestId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ status: decision }),
      })
      await loadOrganization()
      setOrganizationMessage(
        decision === 'APPROVED' ? 'Request approved.' : 'Request rejected.',
      )
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  const promoteMember = async (memberId) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/members/${memberId}/manager`, {
        method: 'POST',
      })
      await loadOrganization()
      setOrganizationMessage('The member is now an organization manager.')
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  const demoteMember = async (memberId) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/members/${memberId}/user`, {
        method: 'POST',
      })
      await loadOrganization()
      setOrganizationMessage('The member is now a user.')
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  const deactivateOrganization = async () => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request('/api/profile/organization', { method: 'DELETE' })
      setOrganization(null)
      signIn(await request('/api/auth/me'))
      setOrganizationRequests(await request('/api/profile/organization/requests'))
      setOrganizationMessage('Organization deactivated. Its members are no longer affiliated.')
    } catch (cause) {
      setOrganizationError(cause.message)
    } finally {
      setOrganizationBusy(false)
    }
  }

  return (
    <>
      <AppHeader />
      <Container maxWidth="lg" component="main" className="profile-container">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 3 }}>
          My Profile
        </Typography>
        <Box className="profile-layout">
          <Tabs
            orientation="vertical"
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value)
              if (value === 1) loadOrganization()
            }}
            aria-label="Profile sections"
            className="profile-tabs"
          >
            {profileTabs.map((tab) => <Tab key={tab} label={tab} />)}
          </Tabs>
          <Box className="profile-panel" role="tabpanel">
            {activeTab === 0 && (
              <Card className="status-card">
                <CardContent>
                  <Stack spacing={3} component="form" onSubmit={saveAccount}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width: 64, height: 64 }}>{user?.name?.[0]}</Avatar>
                      <Box>
                        <Typography variant="h5" component="h2" fontWeight={800}>
                          Account details
                        </Typography>
                        <Chip size="small" label={user?.role} sx={{ mt: 1 }} />
                      </Box>
                    </Stack>
                    {accountMessage && (
                      <Alert severity={accountMessage.severity}>{accountMessage.text}</Alert>
                    )}
                    <TextField
                      label="Name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      fullWidth
                      inputProps={{ maxLength: 120 }}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      fullWidth
                    />
                    <Divider />
                    <Typography variant="h6">Change password</Typography>
                    <TextField
                      label="Current password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      required={Boolean(newPassword)}
                      fullWidth
                    />
                    <TextField
                      label="New password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      inputProps={{ minLength: 8, maxLength: 128 }}
                      helperText="Use between 8 and 128 characters."
                      fullWidth
                    />
                    <TextField
                      label="Confirm new password"
                      type="password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      autoComplete="new-password"
                      required={Boolean(newPassword)}
                      inputProps={{ minLength: 8, maxLength: 128 }}
                      fullWidth
                    />
                    <Button type="submit" variant="contained" disabled={accountBusy}>
                      {accountBusy ? <CircularProgress size={22} /> : 'Save changes'}
                    </Button>
                    <Divider />
                    <Typography variant="h6" color="error">Deactivate account</Typography>
                    <Typography color="text.secondary">
                      Your account will be deactivated and you will be signed out. This action
                      preserves your account history.
                    </Typography>
                    <Button
                      type="button"
                      color="error"
                      variant="outlined"
                      onClick={() => {
                        setDeactivationPassword('')
                        setDeactivationError('')
                        setDeactivationOpen(true)
                      }}
                    >
                      Deactivate my account
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {activeTab === 1 && (
              <Stack spacing={3}>
                <Typography variant="h5" component="h2" fontWeight={800}>
                  Organization
                </Typography>
                {organizationError && <Alert severity="error">{organizationError}</Alert>}
                {organizationMessage && <Alert severity="success">{organizationMessage}</Alert>}
                {organizationLoading && <CircularProgress aria-label="Loading organization" />}
                {!organizationLoading && organization && (
                  <OrganizationDetails
                    organization={organization}
                    busy={organizationBusy}
                    onDecide={decideRequest}
                    onPromote={promoteMember}
                    onDemote={demoteMember}
                    onDeactivate={deactivateOrganization}
                    userId={user?.user_id}
                  />
                )}
                {!organizationLoading && !organization && user?.role === 'ADMIN' && (
                  <Alert severity="info">
                    ADMIN accounts are global and cannot belong to organizations.
                  </Alert>
                )}
                {!organizationLoading && !organization && user?.role !== 'ADMIN' && (
                  <OrganizationOptions
                    busy={organizationBusy}
                    name={organizationName}
                    description={organizationDescription}
                    address={organizationAddress}
                    logo={organizationLogo}
                    searchText={searchText}
                    searchPerformed={searchPerformed}
                    results={searchResults}
                    requests={organizationRequests}
                    onNameChange={setOrganizationName}
                    onDescriptionChange={setOrganizationDescription}
                    onAddressChange={setOrganizationAddress}
                    onLogoChange={(event) => setOrganizationLogo(event.target.files?.[0] ?? null)}
                    onSearchTextChange={(value) => {
                      setSearchText(value)
                      setSearchPerformed(false)
                      setSearchResults([])
                    }}
                    onCreate={createOrganization}
                    onSearch={searchOrganizations}
                    onRequest={requestMembership}
                  />
                )}
              </Stack>
            )}

            {activeTab === 2 && <Box className="profile-empty-panel" />}
            {activeTab === 3 && <Box className="profile-empty-panel" />}
          </Box>
        </Box>
      </Container>
      <Dialog
        open={deactivationOpen}
        onClose={() => {
          if (!accountBusy) setDeactivationOpen(false)
        }}
        aria-labelledby="deactivate-account-title"
      >
        <DialogTitle id="deactivate-account-title">Deactivate your account?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              Your organization membership will be removed. If you are its only active manager,
              first promote another manager or deactivate the organization.
            </Typography>
            {deactivationError && <Alert severity="error">{deactivationError}</Alert>}
            <TextField
              label="Current password"
              type="password"
              value={deactivationPassword}
              onChange={(event) => setDeactivationPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivationOpen(false)} disabled={accountBusy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={deactivateAccount}
            disabled={accountBusy || !deactivationPassword}
          >
            {accountBusy ? <CircularProgress size={22} /> : 'Deactivate account'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function OrganizationOptions({
  busy,
  name,
  description,
  address,
  logo,
  searchText,
  searchPerformed,
  results,
  requests,
  onNameChange,
  onDescriptionChange,
  onAddressChange,
  onLogoChange,
  onSearchTextChange,
  onCreate,
  onSearch,
  onRequest,
}) {
  const [activeOptionTab, setActiveOptionTab] = useState(0)

  return (
    <Box className="organization-options-layout">
      <Tabs
        orientation="vertical"
        value={activeOptionTab}
        onChange={(_, value) => setActiveOptionTab(value)}
        aria-label="Organization options"
        className="organization-option-tabs"
      >
        <Tab label="Request access" />
        <Tab label="Create organization" />
      </Tabs>
      <Box className="organization-option-content" role="tabpanel">
        {activeOptionTab === 0 && (
          <Stack spacing={3}>
            <Card className="status-card">
              <CardContent>
                <Stack spacing={2} component="form" onSubmit={onSearch}>
                  <Typography variant="h6" fontWeight={700}>Request access</Typography>
                  <Typography color="text.secondary">
                    Search for an organization. One of its managers must approve your request.
                  </Typography>
                  <TextField
                    label="Organization name"
                    value={searchText}
                    onChange={(event) => onSearchTextChange(event.target.value)}
                    inputProps={{ minLength: 2, maxLength: 160 }}
                    required
                  />
                  <Button type="submit" variant="outlined" disabled={busy}>
                    Search organizations
                  </Button>
                  {results.map((organization) => (
                    <Card key={organization.org_id} variant="outlined">
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                          {organization.logo_url && (
                            <Avatar
                              src={apiUrl(organization.logo_url)}
                              alt={`${organization.name} logo`}
                            />
                          )}
                          <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={700}>{organization.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {organization.description} · {organization.address}
                            </Typography>
                          </Box>
                          <Button
                            onClick={() => onRequest(organization.org_id)}
                            disabled={
                              busy
                              || requests.some(
                                (joinRequest) => joinRequest.organization_id === organization.org_id
                                  && joinRequest.status === 'PENDING',
                              )
                            }
                          >
                            {requests.some(
                              (joinRequest) => joinRequest.organization_id === organization.org_id
                                && joinRequest.status === 'PENDING',
                            ) ? 'Pending' : 'Request to join'}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  {searchPerformed && results.length === 0 && (
                    <Typography color="text.secondary">
                      No matching organizations were found in the app.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
            {requests.length > 0 && (
              <Card className="status-card">
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                    My requests
                  </Typography>
                  {requests.map((joinRequest) => (
                    <Box key={joinRequest.request_id} className="record-row">
                      <Typography fontWeight={600}>{joinRequest.organization_name}</Typography>
                      <Chip
                        size="small"
                        label={requestStatusLabel(joinRequest.status)}
                        color={joinRequest.status === 'APPROVED' ? 'success' : 'default'}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </Stack>
        )}
        {activeOptionTab === 1 && (
          <Card className="status-card">
            <CardContent>
              <Stack spacing={2} component="form" onSubmit={onCreate}>
                <Typography variant="h6" fontWeight={700}>Create an organization</Typography>
                <TextField label="Name" value={name} onChange={(event) => onNameChange(event.target.value)} required inputProps={{ maxLength: 160 }} />
                <TextField label="Description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} required multiline minRows={3} />
                <TextField label="Address" value={address} onChange={(event) => onAddressChange(event.target.value)} required />
                <Button variant="outlined" component="label">
                  {logo ? `Logo: ${logo.name}` : 'Choose logo (optional)'}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onLogoChange}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  PNG, JPEG, or WebP; up to 5 MiB.
                </Typography>
                <Button type="submit" variant="contained" disabled={busy}>
                  Create organization
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  )
}

function OrganizationDetails({
  organization,
  busy,
  onDecide,
  onPromote,
  onDemote,
  onDeactivate,
  userId,
}) {
  const [deactivationOpen, setDeactivationOpen] = useState(false)
  const isManager = organization.members.some(
    (member) => member.user_id === userId && member.role === 'MANAGER',
  )

  return (
    <Stack spacing={3}>
      <Card className="status-card">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              {organization.logo_url && (
                <Avatar
                  src={apiUrl(organization.logo_url)}
                  alt={`${organization.name} logo`}
                  sx={{ width: 72, height: 72 }}
                />
              )}
              <Box>
                <Typography variant="h5" fontWeight={800}>{organization.name}</Typography>
                <Typography color="text.secondary">{organization.address}</Typography>
              </Box>
            </Stack>
            <Typography>{organization.description}</Typography>
            <Divider />
            <Typography variant="h6" fontWeight={700}>
              Members ({organization.members.length})
            </Typography>
            {organization.members.map((member) => (
              <Box key={member.user_id} className="profile-member-row">
                <Box>
                  <Typography fontWeight={600}>{member.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{member.email}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={member.role === 'MANAGER' ? 'Manager' : 'User'} size="small" />
                  {isManager && member.role === 'USER' && (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => onPromote(member.user_id)}
                    >
                      Make manager
                    </Button>
                  )}
                  {isManager && member.role === 'MANAGER' && member.user_id !== userId && (
                    <Button
                      size="small"
                      color="warning"
                      disabled={busy}
                      onClick={() => onDemote(member.user_id)}
                    >
                      Remove manager role
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {isManager && (
        <>
          <Card className="status-card">
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Pending requests ({organization.pending_requests.length})
              </Typography>
              {organization.pending_requests.length === 0 && (
                <Typography color="text.secondary">There are no pending requests.</Typography>
              )}
              {organization.pending_requests.map((joinRequest) => (
                <Box key={joinRequest.request_id} className="profile-member-row">
                  <Box>
                    <Typography fontWeight={600}>{joinRequest.user.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {joinRequest.user.email}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => onDecide(joinRequest.request_id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy}
                      onClick={() => onDecide(joinRequest.request_id, 'APPROVED')}
                    >
                      Approve
                    </Button>
                  </Stack>
                </Box>
              ))}
            </CardContent>
          </Card>
          <Card className="status-card">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" color="error" fontWeight={700}>
                  Deactivate organization
                </Typography>
                <Typography color="text.secondary">
                  All members will be detached, managers will become users, and pending requests
                  will be cancelled. Configurations and history will be kept.
                </Typography>
                <Button
                  color="error"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => setDeactivationOpen(true)}
                >
                  Deactivate organization
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Dialog
            open={deactivationOpen}
            onClose={() => {
              if (!busy) setDeactivationOpen(false)
            }}
            aria-labelledby="deactivate-organization-title"
          >
            <DialogTitle id="deactivate-organization-title">
              Deactivate {organization.name}?
            </DialogTitle>
            <DialogContent>
              This will remove all members from the organization, downgrade its managers, and
              cancel pending requests. Saved configurations and history will be preserved.
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeactivationOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                color="error"
                variant="contained"
                disabled={busy}
                onClick={async () => {
                  await onDeactivate()
                  setDeactivationOpen(false)
                }}
              >
                {busy ? <CircularProgress size={22} /> : 'Deactivate organization'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Stack>
  )
}

function requestStatusLabel(status) {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  if (status === 'CANCELLED') return 'Cancelled after joining another organization'
  return 'Pending'
}

export default ProfilePage
