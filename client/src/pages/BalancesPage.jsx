import { ArrowDownLeft, ArrowUpRight, Check, CircleHelp, Sparkles } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import SectionTitle from '../components/SectionTitle'
import { usePeople } from '../hooks/usePeople'
import { money } from '../utils/finance'

export default function BalancesPage({ trip, balances, total, onSettle }) {
  const people = usePeople()
  const you = balances.find(item => item.id === 'you')?.balance || 0
  return <div className="page-stack page-enter">
    <div className="page-topline"><span className="eyebrow">EVERYONE ON THE SAME PAGE</span><span className="page-count-pill">{balances.length} members</span></div>
    <SectionTitle title="Group balances" description="See where everyone stands after the shared costs." action={<button className="button button-lime-dark" onClick={onSettle}><ArrowUpRight size={16}/> Settle up</button>}/>
    <section className="balance-hero"><div className="balance-hero-copy"><span className="hero-kicker"><i/> YOUR TRIP AT A GLANCE</span><h2>{money(total, trip.currency)}<span> shared together</span></h2><p>Balances update whenever an expense is added or a payment is confirmed.</p></div><div className="balance-hero-self"><Avatar id="you" size="lg"/><span><small>Your balance</small><b className={you >= 0 ? 'balance-positive' : 'balance-negative'}>{you >= 0 ? '+' : '−'}{money(you, trip.currency)}</b><em>{you >= 0 ? 'You should receive' : 'You owe the group'}</em></span>{you >= 0 ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}</div></section>
    <div className="balance-section-heading"><div><span className="eyebrow">MEMBER BREAKDOWN</span><h2>Where each person stands</h2></div><span className="balance-legend"><i/> Receives <i/> Owes</span></div>
    <section className="balance-grid">{balances.map((item,index)=>{const person=people.find(entry=>entry.id===item.id);return <article className={`balance-member-card balance-card-${index}`} key={item.id}><div className="balance-member-top"><Avatar id={item.id} size="lg"/><span className={`balance-state ${item.balance>0?'state-receive':item.balance<0?'state-owe':'state-clear'}`}>{item.balance>0?'gets back':item.balance<0?'owes':'all clear'}</span></div><h3>{person?.name||item.id}{item.id==='you'&&<small>YOU</small>}</h3><strong className={item.balance>0?'balance-positive':item.balance<0?'balance-negative':'balance-neutral'}>{item.balance>0?'+':item.balance<0?'−':''}{money(item.balance,trip.currency)}</strong><div className="member-card-foot"><span>{item.balance>0?<ArrowDownLeft size={14}/>:item.balance<0?<ArrowUpRight size={14}/>:<Check size={14}/>} {item.balance>0?'receives from the group':item.balance<0?'to pay the group':'nothing to settle'}</span></div><div className="member-card-glow"/></article>})}</section>
    <div className="balance-explainer"><span><Sparkles size={16}/></span><div><b>How we calculate this</b><p>What someone paid, minus their own share of expenses, plus payments they’ve confirmed sending. Equal splits handle leftover cents fairly.</p></div><CircleHelp size={16}/></div>
  </div>
}
