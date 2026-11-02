const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function apiUrl(path) {
  return new URL(path, API_URL).toString()
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data.detail ?? 'The request could not be completed.', response.status)
  }
  return data
}
