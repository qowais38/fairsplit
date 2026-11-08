import { useState } from 'react'
import ModalFrame from '../../components/ui/ModalFrame'

export default function DeleteTripModal({ trip, onDelete, onClose, busy }) {
  const [confirmation, setConfirmation] = useState('')
  return <ModalFrame eyebrow="MANAGE TRIP" title="Delete this trip?" onClose={onClose}>
    <form className="expense-form" onSubmit={event => { event.preventDefault(); if (!busy && confirmation === trip.name) onDelete(trip.id) }}>
      <p className="form-error">Deleting <b>{trip.name}</b> permanently removes its expenses, submissions, payment history, saved receipts, memberships, and invitation links for everyone. This cannot be undone. Member accounts and other trips stay available.</p>
      <label className="form-label">Type trip name to confirm<input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" required/></label>
      <p className="form-hint">Enter exactly: <b>{trip.name}</b></p>
      <div className="delete-confirm-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Keep trip</button><button type="submit" className="button button-danger" disabled={busy || confirmation !== trip.name}>{busy ? 'Deleting…' : 'Delete trip permanently'}</button></div>
    </form>
  </ModalFrame>
}
