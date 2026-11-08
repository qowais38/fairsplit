import { useRef, useState } from 'react'
import { api } from '../../services/api'

export default function AccountPicker({ selected, onChange, excluded = [], disabled = false }) {
  const [email, setEmail] = useState(''), [error, setError] = useState(''), [searching, setSearching] = useState(false)
  const request = useRef(0)
  async function find() {
    const id = ++request.current
    setSearching(true); setError('')
    try {
      const { user } = await api(`/users/lookup?email=${encodeURIComponent(email.trim())}`)
      if (id !== request.current) return
      if (excluded.includes(user.id) || selected.some(item => item.id === user.id)) { setError('This account is already included.'); return }
      onChange([...selected, user]); setEmail('')
    } catch (err) { if (id === request.current) setError(err.message) }
    finally { if (id === request.current) setSearching(false) }
  }
  return <div className="account-picker">
    <label className="form-label">Member email<input type="email" maxLength={254} placeholder="friend@example.com" value={email} disabled={disabled || searching} onChange={event => { setEmail(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (email.trim() && !searching) find() } }}/></label>
    <button type="button" className="button button-outline" disabled={disabled || searching || !email.trim() || selected.length >= 30} onClick={find}>{searching ? 'Finding…' : 'Find account'}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="selected-accounts">{selected.map(user => <div key={user.id} className="selected-account"><span><b>{user.name}</b><small>{user.email}</small></span><button type="button" disabled={disabled || searching} aria-label={`Remove ${user.name}`} onClick={() => onChange(selected.filter(item => item.id !== user.id))}>Remove</button></div>)}</div>
    <p className="form-hint">Find an existing account by its full email. New members can create their own account on the sign-in screen. Each person signs in separately.</p>
  </div>
}
