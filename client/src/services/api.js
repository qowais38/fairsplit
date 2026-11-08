export async function api(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, { method, credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, ...(method !== 'GET' && method !== 'DELETE' ? { body: JSON.stringify(body || {}) } : {}) })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Cannot reach FairSplit. Check your connection and try again.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('fairsplit:session-expired'))
    throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { status: response.status })
  }
  return data
}
