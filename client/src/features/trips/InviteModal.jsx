import { useState } from 'react'
import ModalFrame from '../../components/ui/ModalFrame'
import { api } from '../../services/api'
export default function InviteModal({ trip, onClose, onCopied }) {
  const [link,setLink]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('')
  async function generate() { setBusy(true);setError(''); try { const result=await api(`/trips/${trip.id}/invites`,{method:'POST'});setLink(result.url) } catch(err){setError(err.message)} finally{setBusy(false)} }
  async function copy() { try { await navigator.clipboard.writeText(link);onCopied() } catch { setError('Select and copy the link below.') } }
  return <ModalFrame eyebrow={trip.name} title="Invite your people" onClose={onClose}>
    <p className="invite-intro">Anyone with this link can sign in and join this trip. Share it only with your group. The link expires in seven days.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {link&&<label className="form-label">Trip invite link<input value={link} readOnly onFocus={e=>e.target.select()}/></label>}
    {trip.isOwner?<><button className="button button-lime-dark modal-submit" disabled={busy} onClick={generate}>{busy?'Creating…':link?'Replace invite link':'Create invite link'}</button>{link&&<button className="button button-outline modal-submit" onClick={copy}>Copy invite link</button>}<p className="form-hint">Creating a new link revokes the previous link.</p></>:<p>Ask the trip creator for an invitation link.</p>}
  </ModalFrame>
}
