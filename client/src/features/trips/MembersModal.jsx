import { useState } from 'react'
import ModalFrame from '../../components/ui/ModalFrame'
import AccountPicker from './AccountPicker'
export default function MembersModal({ trip, profileId, onSave, onClose, busy }) {
  const [members, setMembers] = useState([])
  return <ModalFrame eyebrow={trip.name} title="Add registered members" onClose={onClose}>
    <p className="form-hint">New members see this trip in their dashboard. Existing expenses keep their original shares; future expenses include the updated group.</p>
    <AccountPicker selected={members} onChange={setMembers} excluded={[profileId, ...trip.members]} disabled={busy}/>
    <button className="button button-lime-dark modal-submit" disabled={busy || !members.length} onClick={() => onSave(members.map(user => user.id))}>{busy ? 'Adding…' : 'Add members'}</button>
  </ModalFrame>
}
