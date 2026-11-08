import SectionTitle from '../components/SectionTitle'
import { usePeople } from '../hooks/usePeople'
import { money } from '../utils/finance'
export default function ApprovalsPage({ trip, submissions, onReview, onEdit, onDelete, busy }) {
  const people=usePeople()
  const label=id=>id==='you'?'You':people.find(p=>p.id===id)?.name||'Member'
  const pending=submissions.filter(e=>e.status==='pending')
  const ordered=[...submissions].sort((a,b)=>(a.status==='pending'?-1:1)-(b.status==='pending'?-1:1)||(b.createdAt||b.date).localeCompare(a.createdAt||a.date))
  return <div className="page-stack page-enter">
    <SectionTitle eyebrow={trip.isOwner?'MANAGER WORKSPACE':'YOUR SUBMISSIONS'} title={trip.isOwner?'Expense approvals':'My expense submissions'} description={trip.status==='completed'?'This trip has ended. Submissions are read-only; rejected expenses are excluded from the receipt.':trip.isOwner?'Check who paid before accepting a cost. Approved expenses split equally across the current trip members.':'Your submitted expenses appear here until approved. Rejected submissions can be edited and sent again.'}/>
    <div className="workflow-note"><b>{pending.length} awaiting approval</b><p>Pending and rejected expenses do not change anyone's balance. Approval includes all current members; any remaining cents are distributed fairly.</p></div>
    <div className="submission-list">{ordered.length?ordered.map(expense=><article className="surface-card submission-card" key={expense.id}>
      <div className="submission-top"><div><span className={`review-status ${expense.status}`}>{expense.status==='pending'?'Awaiting approval':'Rejected'}</span><h2>{expense.title}</h2><p>Submitted by {label(expense.submittedBy)} · {expense.date} · {expense.category}</p></div><strong>{money(expense.amount,trip.currency)}</strong></div>
      <div className="submission-payers">{Object.entries(expense.contributions).map(([id,n])=><span key={id}>{label(id)} paid <b>{money(n,trip.currency)}</b></span>)}</div>
      <div className="portal-actions">{expense.canReview&&<><button className="button button-lime-dark" disabled={busy} onClick={()=>onReview(expense,'approve')}>Approve expense</button><button className="button button-outline" disabled={busy} onClick={()=>onReview(expense,'reject')}>Reject expense</button></>}{expense.canEdit&&<button className="button button-outline" disabled={busy} onClick={()=>onEdit(expense)}>Edit submission</button>}{expense.canDelete&&<button className="button button-outline" disabled={busy} onClick={()=>onDelete(expense)}>Remove submission</button>}</div>
    </article>):<div className="empty-inline">{trip.isOwner?'No expenses waiting for review.':'You have no pending or rejected submissions.'}</div>}</div>
  </div>
}
