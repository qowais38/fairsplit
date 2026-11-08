import { ArrowRight, ArrowUpRight, Check, CircleHelp, Clock3, Sparkles, X } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import SectionTitle from '../components/SectionTitle'
import { usePeople } from '../hooks/usePeople'
import { money, formatDate } from '../utils/finance'

export default function SettleUpPage({ trip, transfers, balances, settlements, total, onRecord, onConfirm, onCancel, busy }) {
  const people = usePeople()
  const pending = settlements.filter(item => item.status === 'awaiting')
  const confirmed = settlements.filter(item => item.status === 'confirmed')
  const name = id => people.find(person => person.id === id)?.name || 'Member'
  return <div className="page-stack page-enter settle-page">
    <div className="page-topline"><span className="eyebrow">THE LAST LITTLE BIT</span><span className="page-count-pill">{transfers.length} suggested transfers</span></div>
    <SectionTitle title="Settle up" description="A simple plan to bring everyone back to even. Each sender records their payment; the recipient confirms receipt."/>
    <section className="settle-hero">
      <div><span className="hero-kicker"><i/> YOUR GROUP BALANCE</span><h2>{transfers.length ? `${transfers.length} small steps` : pending.length ? 'Awaiting confirmation' : 'All square, all smiles'}</h2><p>{transfers.length ? 'Follow these payments and the trip is settled.' : pending.length ? 'Recorded payments are waiting for their recipients to confirm.' : 'Everyone’s balance is clear. Go make another memory.'}</p></div>
      <div className="settle-hero-mark"><span>{transfers.length || (pending.length ? <Clock3 size={24}/> : <Check size={24}/>)}</span><small>{transfers.length ? 'transfers' : pending.length ? 'pending' : 'settled'}</small></div>
      <div className="settle-hero-foot"><span><b>{money(total,trip.currency)}</b> total trip spend</span><span>{balances.length} friends sharing</span></div>
    </section>
    {transfers.length > 0 ? <section className="plan-section">
      <div className="plan-heading"><div><span className="eyebrow">A CLEAR REPAYMENT ROUTE</span><h2>Suggested payments</h2></div><span className="plan-badge"><Sparkles size={13}/> Simplified repayments</span></div>
      <div className="plan-list">{transfers.map((transfer,index) => <article className="plan-row" key={`${transfer.from}-${transfer.to}`} style={{'--row-index':index}}>
        <span className="plan-index">{String(index+1).padStart(2,'0')}</span>
        <div className="plan-party"><Avatar id={transfer.from} size="md"/><div className="plan-person"><b>{name(transfer.from)}</b><small>pays</small></div></div>
        <ArrowRight className="plan-route-arrow" size={19} aria-hidden="true"/>
        <div className="plan-party"><Avatar id={transfer.to} size="md"/><div className="plan-person"><b>{name(transfer.to)}</b><small>receives</small></div></div>
        <div className="plan-tail"><strong className="plan-amount">{money(transfer.amount,trip.currency)}</strong><div className="plan-actions">
          {trip.recordableMembers.includes(transfer.from) ? <button className="button settlement-button settlement-button-primary" disabled={busy} onClick={()=>onRecord(transfer)}><ArrowUpRight size={16}/> Record payment</button> : <span className="plan-permission-note">Only the sender can record this payment</span>}
        </div></div>
      </article>)}</div>
      <p className="plan-caption"><Sparkles size={14}/> FairSplit finds a clear repayment route from the group’s combined balances.</p>
    </section> : <div className="empty-settlement"><span>{pending.length ? <Clock3 size={23}/> : <Check size={23}/>}</span><h3>{pending.length ? 'Payments awaiting confirmation' : 'Everyone is settled up'}</h3><p>{pending.length ? 'Balances update after the recipient confirms.' : 'Any new shared cost will show up here.'}</p></div>}
    <section className="payment-activity">
      <div className="plan-heading"><div><span className="eyebrow">PAYMENT JOURNAL</span><h2>Payment activity</h2></div><span className="activity-count">{pending.length} pending · {confirmed.length} confirmed</span></div>
      {settlements.length ? <div className="payment-list">{settlements.map(payment => <article className="payment-activity-row" key={payment.id}>
        <Avatar id={payment.from} size="sm"/>
        <div className="payment-activity-copy"><b>{name(payment.from)} <span>paid</span> {name(payment.to)}</b><small>{payment.status==='confirmed' ? `Confirmed ${formatDate(payment.confirmedAt?.slice(0,10))}` : payment.status==='cancelled' ? 'Payment cancelled' : 'Waiting for the recipient to confirm'}</small></div>
        <div className="payment-meta"><strong>{money(payment.amount,trip.currency)}</strong><span className={`payment-state ${payment.status}`}>{payment.status==='confirmed' ? <Check size={13}/> : payment.status==='cancelled' ? <X size={13}/> : <Clock3 size={13}/>} {payment.status==='confirmed' ? 'Confirmed' : payment.status==='cancelled' ? 'Cancelled' : 'Pending'}</span></div>
        {payment.status==='awaiting'&&(payment.canConfirm||payment.canCancel)&&<div className="payment-actions">
          {payment.canConfirm&&<button className="confirm-payment settlement-button settlement-button-primary" disabled={busy} onClick={()=>onConfirm(payment.id)}><Check size={16}/> Confirm received</button>}
          {payment.canCancel&&<button className="confirm-payment settlement-button settlement-button-secondary" disabled={busy} onClick={()=>onCancel(payment.id)}><X size={15}/> Cancel</button>}
        </div>}
      </article>)}</div> : <div className="empty-activity">No payments recorded yet. When someone pays outside FairSplit, add it here for the recipient to confirm.</div>}
    </section>
    <div className="payment-disclaimer"><CircleHelp size={17}/><span><b>Payments stay in your hands.</b> FairSplit records and confirms repayments; it doesn’t move money.</span></div>
  </div>
}
