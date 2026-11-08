import { Check, Clock3, Plus, Users, Wallet } from 'lucide-react'
import { getBalances, money } from '../utils/finance'
import SectionTitle from '../components/SectionTitle'

export default function DashboardPage({ profile, trips, expenses, settlements, onOpenTrip, onCreateTrip }) {
  const summaries = trips.map(trip => ({ trip, balance: getBalances(trip,expenses,settlements).find(item=>item.id==='you')?.balance||0, pending:expenses.filter(e=>e.tripId===trip.id&&e.status==='pending').length }))
  const owed = summaries.reduce((n,item)=>n+Math.max(0,item.balance),0)
  const owe = summaries.reduce((n,item)=>n+Math.max(0,-item.balance),0)
  const reviews = expenses.filter(e=>e.canReview)
  const receipts = settlements.filter(p=>p.status==='awaiting'&&p.canConfirm)
  const recent = expenses.filter(e=>e.status==='approved').sort((a,b)=>(b.reviewedAt||b.updatedAt||b.createdAt||b.date).localeCompare(a.reviewedAt||a.updatedAt||a.createdAt||a.date)).slice(0,8)
  return <div className="page-stack page-enter">
    <SectionTitle eyebrow="YOUR PERSONAL WORKSPACE" title={`Welcome, ${profile.name.split(' ')[0]}`} description="Your trips, approvals, and payments across every group." action={<button className="button button-lime-dark" onClick={onCreateTrip}><Plus size={16}/> Create a trip</button>}/>
    <section className="portal-stats">
      <article className="surface-card"><Users size={20}/><span>Your trips</span><strong>{trips.length}</strong><small>{trips.filter(t=>t.isOwner).length} managed by you</small></article>
      <article className="surface-card"><Wallet size={20}/><span>You need to pay</span><strong>{money(owe)}</strong><small>Across your trips</small></article>
      <article className="surface-card"><Check size={20}/><span>You should receive</span><strong>{money(owed)}</strong><small>After confirmed repayments</small></article>
    </section>
    {(reviews.length>0||receipts.length>0)&&<section className="workflow-note attention-note"><b><Clock3 size={17}/> Needs your attention</b>{reviews.length>0&&<p>{reviews.length} expense submission{reviews.length===1?'':'s'} waiting for your approval.</p>}{receipts.length>0&&<p>{receipts.length} payment{receipts.length===1?'':'s'} waiting for you to confirm receipt.</p>}<div className="portal-actions">{[...new Set(reviews.map(e=>e.tripId))].map(id=><button className="button button-outline" key={id} onClick={()=>onOpenTrip(id,'Approvals')}>Review · {trips.find(t=>t.id===id)?.name}</button>)}{[...new Set(receipts.map(e=>e.tripId))].map(id=><button className="button button-outline" key={id} onClick={()=>onOpenTrip(id,'Settle up')}>Confirm receipt · {trips.find(t=>t.id===id)?.name}</button>)}</div></section>}
    <section><SectionTitle title="Your trips" description="You can manage one trip and be a member of another."/><div className="portal-trip-grid">{summaries.map(({trip,balance,pending})=><article className="surface-card portal-trip" key={trip.id}>
      <div className="portal-trip-top"><span className={`role-badge ${trip.isOwner?'manager':''}`}>{trip.isOwner?'Manager':'Member'}</span><small>{trip.members.length} members</small></div><h2>{trip.name}</h2><p>{trip.location||'Your next adventure'} · Manager: {trip.managerName}</p><strong className={balance<0?'balance-negative':'balance-positive'}>{balance<0?'You owe':balance>0?'You receive':'Settled'} {balance!==0&&money(balance,trip.currency)}</strong>
      <div className="portal-actions"><button className="button button-lime-dark" onClick={()=>onOpenTrip(trip.id,'Overview')}>Open trip</button>{pending>0&&<button className="button button-outline" onClick={()=>onOpenTrip(trip.id,'Approvals')}>{pending} {trip.isOwner?'to review':'pending'}</button>}</div>
    </article>)}</div></section>
    <section className="surface-card portal-activity"><SectionTitle title="Latest approved expenses" description="Your share is included in your balance. Pending submissions are excluded."/>{recent.length?recent.map(expense=><div className="portal-activity-row" key={expense.id}><div><b>{expense.title}</b><small>{trips.find(t=>t.id===expense.tripId)?.name} · Your share {money(expense.shares.you||0)}</small></div><strong>{money(expense.amount)}</strong><button className="button button-outline" onClick={()=>onOpenTrip(expense.tripId,'Expenses')}>View</button></div>):<p className="form-hint">No approved expenses yet. Add your first shared cost inside a trip.</p>}</section>
  </div>
}
