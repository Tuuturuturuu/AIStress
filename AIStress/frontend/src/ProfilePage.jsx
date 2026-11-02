import { useCallback, useEffect, useState } from 'react'
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
  MenuItem,
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

const profileTabs = [
  'Account',
  'Organization',
  'API Configurations',
  'Accessibility',
  'Privacy Data',
]

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

  const promoteMember = async (memberId, currentPassword) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/members/${memberId}/manager`, {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword }),
      })
      await loadOrganization()
      setOrganizationMessage('The member is now an organization manager.')
      return true
    } catch (cause) {
      setOrganizationError(cause.message)
      throw cause
    } finally {
      setOrganizationBusy(false)
    }
  }

  const demoteMember = async (memberId, currentPassword) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/members/${memberId}/user`, {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword }),
      })
      await loadOrganization()
      setOrganizationMessage('The member is now a user.')
      return true
    } catch (cause) {
      setOrganizationError(cause.message)
      throw cause
    } finally {
      setOrganizationBusy(false)
    }
  }

  const removeMember = async (memberId, currentPassword) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request(`/api/profile/organization/members/${memberId}`, {
        method: 'DELETE',
        body: JSON.stringify({ current_password: currentPassword }),
      })
      await loadOrganization()
      setOrganizationMessage('The user was removed from the organization.')
      return true
    } catch (cause) {
      setOrganizationError(cause.message)
      throw cause
    } finally {
      setOrganizationBusy(false)
    }
  }

  const deactivateOrganization = async (currentPassword) => {
    setOrganizationBusy(true)
    setOrganizationError('')
    setOrganizationMessage('')
    try {
      await request('/api/profile/organization', {
        method: 'DELETE',
        body: JSON.stringify({ current_password: currentPassword }),
      })
      setOrganization(null)
      signIn(await request('/api/auth/me'))
      setOrganizationRequests(await request('/api/profile/organization/requests'))
      setOrganizationMessage('Organization deactivated. Its members are no longer affiliated.')
      return true
    } catch (cause) {
      setOrganizationError(cause.message)
      throw cause
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
            variant="scrollable"
            scrollButtons="auto"
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
                    onRemoveMember={removeMember}
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

            {activeTab === 2 && <APIConfigurationsPanel user={user} />}
            {activeTab === 3 && <Box className="profile-empty-panel" />}
            {activeTab === 4 && <Box className="profile-empty-panel" />}
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
  onRemoveMember,
  userId,
}) {
  const [pendingAction, setPendingAction] = useState(null)
  const [actionPassword, setActionPassword] = useState('')
  const [actionError, setActionError] = useState('')
  const isManager = organization.members.some(
    (member) => member.user_id === userId && member.role === 'MANAGER',
  )

  const requestSensitiveAction = (action) => {
    setPendingAction(action)
    setActionPassword('')
    setActionError('')
  }

  const confirmSensitiveAction = async () => {
    if (!pendingAction || !actionPassword) return
    setActionError('')
    try {
      if (pendingAction.type === 'promote') {
        await onPromote(pendingAction.memberId, actionPassword)
      } else if (pendingAction.type === 'demote') {
        await onDemote(pendingAction.memberId, actionPassword)
      } else if (pendingAction.type === 'remove') {
        await onRemoveMember(pendingAction.memberId, actionPassword)
      } else {
        await onDeactivate(actionPassword)
      }
      setPendingAction(null)
    } catch (cause) {
      setActionError(cause.message)
    }
  }

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
                      onClick={() => requestSensitiveAction({
                        type: 'promote',
                        memberId: member.user_id,
                        memberName: member.name,
                      })}
                    >
                      Make manager
                    </Button>
                  )}
                  {isManager && member.role === 'MANAGER' && member.user_id !== userId && (
                    <Button
                      size="small"
                      color="warning"
                      disabled={busy}
                      onClick={() => requestSensitiveAction({
                        type: 'demote',
                        memberId: member.user_id,
                        memberName: member.name,
                      })}
                    >
                      Remove manager role
                    </Button>
                  )}
                  {isManager && member.role === 'USER' && (
                    <Button
                      size="small"
                      color="error"
                      disabled={busy}
                      onClick={() => requestSensitiveAction({
                        type: 'remove',
                        memberId: member.user_id,
                        memberName: member.name,
                      })}
                    >
                      Remove from organization
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
                  onClick={() => requestSensitiveAction({ type: 'deactivate-organization' })}
                >
                  Deactivate organization
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
      <Dialog
        open={pendingAction !== null}
        onClose={() => {
          if (!busy) setPendingAction(null)
        }}
        aria-labelledby="organization-confirm-title"
      >
        <DialogTitle id="organization-confirm-title">
          {pendingAction?.type === 'promote' && `Make ${pendingAction.memberName} a manager?`}
          {pendingAction?.type === 'demote' && `Remove manager role from ${pendingAction.memberName}?`}
          {pendingAction?.type === 'remove' && `Remove ${pendingAction.memberName} from the organization?`}
          {pendingAction?.type === 'deactivate-organization'
            && `Deactivate ${organization.name}?`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              {pendingAction?.type === 'deactivate-organization'
                ? 'Members will be detached, managers will become users, and pending requests will be cancelled. Configurations and history will be preserved.'
                : 'Confirm this change by entering your current password.'}
            </Typography>
            {actionError && <Alert severity="error">{actionError}</Alert>}
            <TextField
              label="Your current password"
              type="password"
              value={actionPassword}
              onChange={(event) => setActionPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAction(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color={pendingAction?.type === 'deactivate-organization'
              || pendingAction?.type === 'remove' ? 'error' : 'primary'}
            variant="contained"
            disabled={busy || !actionPassword}
            onClick={confirmSensitiveAction}
          >
            {busy ? <CircularProgress size={22} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function APIConfigurationsPanel({ user }) {
  const canManage = user?.role === 'MANAGER'
    || (user?.role === 'USER' && user.org_id === null)
  const [catalog, setCatalog] = useState({ models: [], configurations: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [editingConfiguration, setEditingConfiguration] = useState(null)
  const [credentialsJson, setCredentialsJson] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [temperature, setTemperature] = useState('')
  const [maxTokens, setMaxTokens] = useState('')

  const loadConfigurations = useCallback(async () => {
    setError('')
    try {
      setCatalog(await request('/api/profile/api-configurations'))
    } catch (cause) {
      setError(cause.message)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') return undefined
    let active = true
    request('/api/profile/api-configurations')
      .then((response) => {
        if (active) setCatalog(response)
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.user_id, user?.role])

  const resetForm = () => {
    setSelectedModel('')
    setEditingConfiguration(null)
    setCredentialsJson('')
    setEndpoint('')
    setTemperature('')
    setMaxTokens('')
  }

  const beginEdit = (configuration) => {
    setEditingConfiguration(configuration)
    setSelectedModel(String(configuration.model_id))
    setCredentialsJson('')
    setEndpoint(configuration.endpoint ?? '')
    setTemperature(configuration.temperature ?? '')
    setMaxTokens(configuration.max_tokens ?? '')
    setError('')
    setMessage('')
  }

  const submitConfiguration = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    let credentials
    if (credentialsJson.trim()) {
      try {
        credentials = JSON.parse(credentialsJson)
      } catch {
        setError('Credentials must be valid JSON.')
        setBusy(false)
        return
      }
      if (
        credentials === null
        || Array.isArray(credentials)
        || typeof credentials !== 'object'
        || Object.keys(credentials).length === 0
      ) {
        setError('Credentials must be a non-empty JSON object.')
        setBusy(false)
        return
      }
    } else if (!editingConfiguration) {
      setError('Enter the credentials as a JSON object.')
      setBusy(false)
      return
    }

    const payload = {
      ...(credentials && { credentials }),
      endpoint: endpoint.trim() || null,
      temperature: temperature === '' ? null : Number(temperature),
      max_tokens: maxTokens === '' ? null : Number(maxTokens),
    }
    try {
      const modelId = editingConfiguration?.model_id ?? Number(selectedModel)
      await request(`/api/profile/api-configurations/${modelId}`, {
        method: editingConfiguration ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      await loadConfigurations()
      resetForm()
      setMessage('API configuration saved.')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const configuredModelIds = new Set(
    catalog.configurations.map((configuration) => configuration.model_id),
  )
  const unconfiguredModels = catalog.models.filter(
    (model) => !configuredModelIds.has(model.model_id),
  )

  if (user?.role === 'ADMIN') {
    return <Alert severity="info">API configurations are not available to ADMIN accounts.</Alert>
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" fontWeight={800}>
        API Configurations
      </Typography>
      {user?.role === 'USER' && user.org_id !== null && (
        <Alert severity="info">
          You can view the models configured by your organization managers. Only managers can add
          or edit organization configurations.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {loading && <CircularProgress aria-label="Loading API configurations" />}
      {!loading && catalog.models.length === 0 && (
        <Alert severity="info">
          No active models are available in the catalog yet.
        </Alert>
      )}
      {!loading && catalog.configurations.length > 0 && (
        <Card className="status-card">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6" fontWeight={700}>
                Configured models ({catalog.configurations.length})
              </Typography>
              {catalog.configurations.map((configuration) => (
                <Box key={configuration.model_id} className="profile-member-row">
                  <Box>
                    <Typography fontWeight={600}>{configuration.model_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {configuration.provider}
                    </Typography>
                    {canManage && (
                      <Typography variant="caption" color="text.secondary">
                        Credentials are encrypted and never returned to the browser.
                      </Typography>
                    )}
                  </Box>
                  {canManage && (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => beginEdit(configuration)}
                    >
                      Edit configuration
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
      {canManage && !loading && catalog.models.length > 0 && (
        <Card className="status-card">
          <CardContent>
            <Stack spacing={2} component="form" onSubmit={submitConfiguration}>
              <Typography variant="h6" fontWeight={700}>
                {editingConfiguration ? 'Edit configuration' : 'Add a model configuration'}
              </Typography>
              {!editingConfiguration && (
                <TextField
                  select
                  label="Model"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  required
                  disabled={unconfiguredModels.length === 0 || busy}
                >
                  {unconfiguredModels.map((model) => (
                    <MenuItem key={model.model_id} value={String(model.model_id)}>
                      {model.provider} — {model.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {editingConfiguration && (
                <Typography color="text.secondary">
                  {editingConfiguration.provider} — {editingConfiguration.model_name}
                </Typography>
              )}
              <TextField
                label="Credentials (JSON)"
                value={credentialsJson}
                onChange={(event) => setCredentialsJson(event.target.value)}
                placeholder={editingConfiguration
                  ? 'Leave blank to keep the saved credentials'
                  : '{"api_key":"your-key"}'}
                helperText="Credentials are encrypted before being stored. Provider-specific forms will be added later."
                multiline
                minRows={3}
                required={!editingConfiguration}
                disabled={busy}
              />
              <TextField
                label="Endpoint (optional)"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                disabled={busy}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Temperature (optional)"
                  type="number"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  inputProps={{ min: 0, max: 9.9999, step: 0.1 }}
                  disabled={busy}
                  fullWidth
                />
                <TextField
                  label="Maximum tokens (optional)"
                  type="number"
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(event.target.value)}
                  inputProps={{ min: 1, step: 1 }}
                  disabled={busy}
                  fullWidth
                />
              </Stack>
              {unconfiguredModels.length === 0 && !editingConfiguration && (
                <Typography color="text.secondary">
                  All active models already have a configuration.
                </Typography>
              )}
              <Stack direction="row" spacing={1}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={busy || (!editingConfiguration && !selectedModel)}
                >
                  {busy ? <CircularProgress size={22} /> : 'Save configuration'}
                </Button>
                {editingConfiguration && (
                  <Button type="button" disabled={busy} onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
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
