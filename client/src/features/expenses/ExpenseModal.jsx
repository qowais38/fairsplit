import { usePeople } from '../../hooks/usePeople'
import { useState } from 'react'
import { Check, Users } from 'lucide-react'
import ModalFrame from '../../components/ui/ModalFrame'
import { equalShares, money } from '../../utils/finance'

const categories = ['Stay','Food','Transport','Groceries','Activities','Other']
export default function ExpenseModal({ trip, expense, onSave, onClose, busy }) {
  const people = usePeople()
  const label = id => id === 'you' ? 'You' : people.find(p => p.id === id)?.name || 'Member'
  const previous = expense?.contributions || (expense ? { [expense.payer]: expense.amount } : { you: 0 })
  const [title,setTitle]=useState(expense?.title||'')
  const [amount,setAmount]=useState(expense?(expense.amount/100).toFixed(2):'')
  const [mode,setMode]=useState(Object.keys(previous).length > 1 ? 'multiple' : 'single')
  const [payer,setPayer]=useState(expense?.payer||'you')
  const [paid,setPaid]=useState(Object.fromEntries(Object.entries(previous).map(([id,n]) => [id,(n/100).toFixed(2)])))
  const [category,setCategory]=useState(expense?.category||'Food')
  const [date,setDate]=useState(expense?.date||new Date().toISOString().slice(0,10))
  const cents=Math.round(Number(amount||0)*100)
  const contributions = mode === 'single' ? { [payer]: cents } : Object.fromEntries(Object.entries(paid).map(([id,n]) => [id,Math.round(Number(n||0)*100)]))
  const paidTotal = Object.values(contributions).reduce((sum,n) => sum+n,0)
  const valid = title.trim() && Number.isSafeInteger(cents) && cents>0 && cents<=100000000 && paidTotal===cents && Object.values(contributions).every(n => Number.isSafeInteger(n) && n>0) && (trip.isOwner || contributions.you > 0)
  const shares = equalShares(cents,trip.members)
  function submit(event) { event.preventDefault(); if(!valid||busy)return; onSave({ ...(expense||{}), title:title.trim(), amount:cents, payer, contributions, category, date, people:trip.members, shares, splitType:'equal' }) }
  return <ModalFrame eyebrow={trip.name.toUpperCase()} title={expense?'Edit expense':'Add an expense'} onClose={onClose}>
    <form onSubmit={submit} className="expense-form"><fieldset className="form-fieldset" disabled={busy}>
      <label className="form-label">What was this for?<input autoFocus maxLength={120} placeholder="e.g. Dinner by the lake" value={title} onChange={event=>setTitle(event.target.value)} required/></label>
      <label className="form-label">Amount<span className="money-input"><span>PKR</span><input aria-label="Amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" value={amount} onChange={event=>setAmount(event.target.value)} required/></span></label>
      <fieldset className="payer-choice"><legend>Who paid the bill?</legend><label><input type="radio" name="payment-mode" checked={mode==='single'} onChange={()=>setMode('single')}/> One person paid</label><label><input type="radio" name="payment-mode" checked={mode==='multiple'} onChange={()=>setMode('multiple')}/> Multiple people paid</label></fieldset>
      {mode==='single' ? <label className="form-label">Paid by<select value={payer} onChange={event=>setPayer(event.target.value)}>{(trip.isOwner ? trip.members : ['you']).map(id=><option key={id} value={id}>{label(id)}</option>)}</select></label> : <div className="contribution-list">{trip.members.map(id=><div className="contribution-row" key={id}><label><input type="checkbox" checked={Object.hasOwn(paid,id)} onChange={event=>setPaid(current=>{const next={...current};if(event.target.checked)next[id]='';else delete next[id];return next})}/>{label(id)}</label>{Object.hasOwn(paid,id)&&<label className="form-label">Paid amount<span className="money-input"><span>PKR</span><input aria-label={`Paid by ${label(id)}`} type="number" min="0.01" step="0.01" value={paid[id]} onChange={event=>setPaid(current=>({...current,[id]:event.target.value}))} required/></span></label>}</div>)}<div className={`split-total ${paidTotal===cents?'good':'bad'}`}><span>Contributions total</span><b>{money(paidTotal,trip.currency)} / {money(cents,trip.currency)}</b></div>{!trip.isOwner&&!contributions.you&&<p className="form-hint">Include your own contribution to submit an expense.</p>}</div>}
      <div className="form-grid"><label className="form-label">Category<select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item}>{item}</option>)}</select></label><label className="form-label">Date<input type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label></div>
      <div className="workflow-note"><b><Users size={15}/> Equal split across all {trip.members.length} members</b><p>{trip.isOwner?'Your expense goes straight into the approved ledger.':'Your expense goes to the manager for approval. Balances update only after approval.'}</p><small>Each share is approximately {money(Math.floor(cents/Math.max(1,trip.members.length)),trip.currency)}; any remaining paisa are distributed fairly.</small></div>
      <button className="button button-lime-dark modal-submit" disabled={!valid||busy}>{busy?'Saving…':expense?'Save changes':trip.isOwner?'Save expense':'Submit for approval'} <Check size={16}/></button>
    </fieldset></form>
  </ModalFrame>
}
