import { useState } from 'react'
import { ArrowUpRight, Check, Banknote } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import ModalFrame from '../../components/ui/ModalFrame'
import { usePeople } from '../../hooks/usePeople'
import { money } from '../../utils/finance'

export default function PaymentModal({ transfer, currency, onSave, onClose, busy }) {
  const people = usePeople()
  const [amount, setAmount] = useState((transfer.amount / 100).toFixed(2))
  const cents = Math.round(Number(amount || 0) * 100)
  const valid = cents > 0 && cents <= transfer.amount
  const from = people.find(item => item.id === transfer.from)
  const to = people.find(item => item.id === transfer.to)
  return <ModalFrame eyebrow="SETTLEMENT" title="Record a payment" onClose={onClose}>
    <div className="payment-route"><div><Avatar id={transfer.from} size="lg"/><b>{from?.name}</b></div><span className="route-arrow"><i/><ArrowUpRight size={16}/><i/></span><div><Avatar id={transfer.to} size="lg"/><b>{to?.name}</b></div></div>
    <label className="form-label payment-amount-label">How much did you send?<span className="money-input"><span>PKR</span><input autoFocus type="number" min="0.01" max={(transfer.amount/100).toFixed(2)} step="0.01" value={amount} onChange={event => setAmount(event.target.value)}/></span></label>
    <div className="partial-hint"><Banknote size={16}/><span>Suggested: <b>{money(transfer.amount,currency)}</b>. A partial payment is fine; we’ll keep the rest on the plan.</span></div>
    <button className="button button-lime-dark modal-submit" disabled={!valid||busy} onClick={() => valid && !busy && onSave(transfer,cents)}>I’ve sent this <Check size={16}/></button>
  </ModalFrame>
}
import React from 'react'
