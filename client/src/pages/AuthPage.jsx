import { useState } from 'react'
import { api } from '../services/api'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState(new URLSearchParams(window.location.search).has('reset') ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'forgot') { await api('/auth/forgot', { method: 'POST', body: { email } }); setSent(true) }
      else if (mode === 'reset') {
        await api('/auth/reset', { method: 'POST', body: { token: new URLSearchParams(window.location.search).get('reset'), password } })
        const url = new URL(window.location.href); url.searchParams.delete('reset'); window.history.replaceState({}, '', url)
        setMode('login'); setPassword(''); setMessage('Password updated. Sign in with your new password.')
      } else {
        const result = await api('/auth/' + mode, { method: 'POST', body: { name, email, password } })
        onAuthenticated(result.user)
      }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-story">
      <a className="auth-brand" href="#home" onClick={event => event.preventDefault()}><span className="brand-mark"><i/><i/><i/><i/></span><span>fair<span>split</span></span></a>
      <div className="auth-story-copy"><span className="auth-kicker"><Sparkles size={14}/> GOOD TRIPS, BETTER SPLITS</span><h1>Make the memories.<br/><em>We’ll sort the math.</em></h1><p>Keep shared costs clear, fair, and out of the group chat scroll.</p>
        <div className="auth-proof"><div className="auth-proof-avatars"><span>MK</span><span>SA</span><span>AR</span><span>AK</span></div><span><b>One trip. One clear plan.</b><small>Everyone knows where they stand.</small></span></div>
      </div>
      <div className="auth-art" aria-hidden="true"><span className="auth-orbit orbit-a"/><span className="auth-orbit orbit-b"/><span className="auth-orbit orbit-c"/><span className="auth-art-sun"/><span className="auth-art-mountain mountain-a"/><span className="auth-art-mountain mountain-b"/><span className="auth-art-water"/><span className="auth-art-card"><Users size={15}/><b>4 friends</b><small>sharing the good stuff</small></span></div>
      <div className="auth-story-foot"><ShieldCheck size={15}/> Your trip costs, all in one place.</div>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap">
      <div className="auth-mobile-brand"><span className="brand-mark"><i/><i/><i/><i/></span><b>fair<span>split</span></b></div>
      <span className="auth-form-kicker">{mode === 'signup' ? 'START YOUR NEXT ADVENTURE' : mode === 'forgot' ? 'PASSWORD RESET' : 'YOUR TRIPS ARE WAITING'}</span>
      <h2>{mode === 'reset' ? 'Choose a new password' : mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Forgot your password?' : 'Welcome back'}</h2>
      <p className="auth-form-intro">{mode === 'reset' ? 'Use at least eight characters for your new password.' : mode === 'signup' ? 'A little less awkward. A lot more adventure.' : mode === 'forgot' ? 'Enter your account email to request a reset link.' : 'Sign in to pick up right where your group left off.'}</p>
      {sent ? <div className="auth-success"><span><Check size={20}/></span><h3>Check your inbox</h3><p>If an account exists for this address, a reset email has been requested. The link expires in 30 minutes.</p><button className="auth-back-link" onClick={()=>{setMode('login');setSent(false)}}><ArrowLeft size={15}/> Back to sign in</button></div> : <form className="auth-form" onSubmit={submit}><fieldset className="form-fieldset" disabled={busy}>
        {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
        {mode === 'signup' && <label className="auth-field"><span>Your name</span><div><Users size={17}/><input autoComplete="name" placeholder="e.g. Maya Kim" value={name} onChange={event=>setName(event.target.value)} required minLength={2}/></div></label>}
        {mode !== 'reset' && <label className="auth-field"><span>Email address</span><div><Mail size={17}/><input autoComplete="email" type="email" maxLength={254} placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)} required/></div></label>}
        {mode !== 'forgot' && <label className="auth-field"><span>Password</span><div><LockKeyhole size={17}/><input autoComplete={mode==='signup'||mode==='reset'?'new-password':'current-password'} type={showPassword?'text':'password'} placeholder={mode==='signup'||mode==='reset'?'At least 8 characters':'Enter your password'} value={password} onChange={event=>setPassword(event.target.value)} required minLength={8} maxLength={128}/><button type="button" className="auth-show-password" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
        {mode === 'login' && <button type="button" className="auth-forgot" onClick={()=>setMode('forgot')}>Forgot password?</button>}
        <button className="auth-submit" type="submit">{busy?'Please wait…':mode==='reset'?'Update password':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Sign in'} <ArrowRight size={17}/></button>
      </fieldset></form>}
      {!sent && <div className="auth-switch">{mode==='login'?'New to FairSplit?':'Already have an account?'} <button disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setSent(false);setError('');setMessage('')}}>{mode==='login'?'Create an account':'Sign in'}</button></div>}
      <div className="auth-legal">By continuing, you agree to keep the trip group kind and the math fair.</div>
    </div></section>
  </main>
}
