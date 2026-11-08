import { useState } from 'react'
import { Check } from 'lucide-react'
import ModalFrame from '../../components/ui/ModalFrame'
import AccountPicker from './AccountPicker'
export default function TripModal({ onSave, onClose, busy, profileId }) {
  const [name,setName]=useState(''), [location,setLocation]=useState(''), [startDate,setStartDate]=useState(''), [endDate,setEndDate]=useState(''), [members,setMembers]=useState([])
  function submit(event) { event.preventDefault(); if (!busy) onSave({ name,location,startDate,endDate,guestNames: [], memberIds: members.map(user => user.id) }) }
  return <ModalFrame eyebrow="PLAN WITH YOUR PEOPLE" title="Create a trip" onClose={onClose}>
    <form onSubmit={submit} className="expense-form"><fieldset disabled={busy} className="form-fieldset">
      <label className="form-label">Trip name<input autoFocus maxLength={80} placeholder="e.g. Big Sur weekend" value={name} onChange={e=>setName(e.target.value)} required/></label>
      <label className="form-label">Destination<input maxLength={120} value={location} onChange={e=>setLocation(e.target.value)}/></label>
      <div className="form-grid"><label className="form-label">Start date<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="form-label">End date<input type="date" min={startDate||undefined} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>
      <div className="workflow-note"><b>You are the trip manager.</b><p>Review member expenses, manage the trip, and see everyone's balances. Members get this trip in their own dashboard.</p></div>
      <AccountPicker selected={members} onChange={setMembers} excluded={[profileId]} disabled={busy}/>
      <button className="button button-lime-dark modal-submit" disabled={!name.trim()||busy}>{busy?'Creating…':'Create trip'} <Check size={16}/></button>
    </fieldset></form>
  </ModalFrame>
}
