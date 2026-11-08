import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import AppShell from '../layouts/AppShell'
import OverviewPage from '../pages/OverviewPage'
import ExpensesPage from '../pages/ExpensesPage'
import BalancesPage from '../pages/BalancesPage'
import SettleUpPage from '../pages/SettleUpPage'
import ExpenseModal from '../features/expenses/ExpenseModal'
import TripModal from '../features/trips/TripModal'
import PaymentModal from '../features/settlements/PaymentModal'
import InviteModal from '../features/trips/InviteModal'
import ModalFrame from '../components/ui/ModalFrame'
import AuthPage from '../pages/AuthPage'
import DashboardPage from '../pages/DashboardPage'
import ApprovalsPage from '../pages/ApprovalsPage'
import MembersModal from '../features/trips/MembersModal'
import DeleteTripModal from '../features/trips/DeleteTripModal'
import { useFairSplit } from '../hooks/useFairSplit'
import { PeopleContext } from '../hooks/usePeople'
import { api } from '../services/api'

export default function App() {
  const [session,setSession]=useState(null), [checking,setChecking]=useState(true), [bootError,setBootError]=useState('')
  const [page,setPage]=useState('Dashboard'), [modal,setModal]=useState(null), [editing,setEditing]=useState(null), [deleting,setDeleting]=useState(null)
  const [notice,setNotice]=useState(''), [actionError,setActionError]=useState(''), [busy,setBusy]=useState(false)
  const lock=useRef(false), joining=useRef(false), noticeTimer=useRef(null)
  const data=useFairSplit(session)
  async function checkSession() {
    setChecking(true);setBootError('')
    try { const result=await api('/auth/me');setSession(result.user) }
    catch(err) { if(err.status!==401)setBootError(err.message) }
    finally {setChecking(false)}
  }
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).has('reset'))setChecking(false)
    else checkSession()
    const expire=()=>{setSession(null);setModal(null);setDeleting(null);setActionError('Your session expired. Please sign in again.')}
    window.addEventListener('fairsplit:session-expired',expire)
    return ()=>{window.removeEventListener('fairsplit:session-expired',expire);clearTimeout(noticeTimer.current)}
  },[])
  function notify(message){setNotice(message);clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),4000)}
  useEffect(()=>{
    const token=new URLSearchParams(window.location.search).get('invite')
    if(!session||!token||joining.current)return
    joining.current=true
    data.joinTrip(token).then(()=>{setPage('Overview');notify('You joined the trip')}).catch(err=>setActionError(err.message)).finally(()=>{
      const url=new URL(window.location.href);url.searchParams.delete('invite');window.history.replaceState({},'',url);joining.current=false
    })
  },[session?.id])
  useEffect(()=>{
    if(!session)return
    const params=new URLSearchParams(window.location.search), trip=params.get('receiptTrip'), receipt=params.get('receipt')
    if(trip&&receipt)window.location.assign(`/api/trips/${encodeURIComponent(trip)}/receipts/${encodeURIComponent(receipt)}`)
  },[session?.id])
  async function perform(work,message,close=true){
    if(lock.current)return
    lock.current=true;setBusy(true);setActionError('')
    try {await work();if(close){setModal(null);setEditing(null);setDeleting(null)}if(message)notify(message)}
    catch(err){setActionError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  function openModal(value){setActionError('');setModal(value)}
  function closeModal(){if(!lock.current){setModal(null);setEditing(null);setDeleting(null)}}
  function openExpense(expense=null){setEditing(expense);openModal('expense')}
  const saveExpense=expense=>perform(()=>data.saveExpense(expense),editing?'Expense updated':data.activeTrip?.isOwner?'Expense added':'Expense sent to the manager for approval')
  const saveTrip=trip=>perform(async()=>{await data.createTrip(trip);setPage('Overview')},'Your trip is ready')
  const savePayment=(transfer,amount)=>perform(()=>data.recordPayment(transfer,amount),'Payment recorded — waiting for confirmation')
  const confirmPayment=id=>perform(()=>data.confirmPayment(id),'Payment confirmed; balances updated',false)
  const cancelPayment=id=>perform(()=>data.cancelPayment(id),'Payment cancelled',false)
  const endSession=()=>perform(async()=>{await api('/auth/logout',{method:'POST'});setSession(null);setPage('Dashboard')},'')
  const reviewExpense=(expense,decision)=>perform(()=>data.reviewExpense(expense,decision),decision==='approve'?'Expense approved; everyone’s balances updated':'Expense rejected',false)
  const openTrip=(id,next='Overview')=>{data.setActiveTripId(id);setPage(next);setActionError('')}
  if(checking)return <div className="app-loading" role="status">Loading FairSplit…</div>
  if(bootError)return <div className="app-loading"><p role="alert">{bootError}</p><button className="button button-lime-dark" onClick={checkSession}>Try again</button></div>
  if(!session)return <AuthPage onAuthenticated={profile=>{setActionError('');setSession(profile)}}/>
  let content
  if(data.loading)content=<div className="app-loading" role="status">Loading your trips…</div>
  else if(!data.activeTrip)content=<div className="empty-workspace"><h1>{data.error?'Your trips could not be loaded':'Your next trip starts here'}</h1><p>{data.error||'Create a trip, invite your group, and keep every shared cost clear.'}</p><button className="button button-lime-dark" onClick={()=>data.error?data.refresh().catch(()=>{}):openModal('trip')}>{data.error?'Try again':'Create your first trip'}</button></div>
  else if(page==='Dashboard')content=<DashboardPage profile={session} trips={data.trips} expenses={data.allExpenses} settlements={data.allSettlements} onOpenTrip={openTrip} onCreateTrip={()=>openModal('trip')}/>
  else if(page==='Approvals')content=<ApprovalsPage trip={data.activeTrip} submissions={data.submissions} onReview={reviewExpense} onEdit={openExpense} onDelete={expense=>{setActionError('');setDeleting(expense)}} busy={busy}/>
  else if(page==='Expenses')content=<ExpensesPage key={data.activeTrip.id} trip={data.activeTrip} expenses={data.tripExpenses} onAddExpense={()=>openExpense()} onEditExpense={openExpense} onDeleteExpense={id=>{setActionError('');setDeleting(data.tripExpenses.find(e=>e.id===id))}}/>
  else if(page==='Balances')content=<BalancesPage trip={data.activeTrip} balances={data.balances} total={data.total} onSettle={()=>setPage('Settle up')}/>
  else if(page==='Settle up')content=<SettleUpPage trip={data.activeTrip} transfers={data.transfers} balances={data.balances} settlements={data.settlements} total={data.total} onRecord={transfer=>{setEditing(transfer);openModal('payment')}} onConfirm={confirmPayment} onCancel={cancelPayment} busy={busy}/>
  else content=<OverviewPage pendingPaymentCount={data.settlements.filter(p=>p.status==='awaiting').length} trip={data.activeTrip} expenses={data.tripExpenses} balances={data.balances} transfers={data.transfers} total={data.total} pendingCount={data.submissions.filter(e=>e.status==='pending').length} onAddExpense={()=>openExpense()} onMembers={()=>openModal('members')} onEndTrip={()=>openModal('endTrip')} onGenerateReceipt={()=>perform(()=>data.generateReceipt(),'Receipt ready. Open it to print, save as PDF, or copy its share link.')} busy={busy} onDeleteTrip={()=>{setEditing(data.activeTrip);openModal('deleteTrip')}} onInvite={()=>openModal('invite')} onEditExpense={openExpense} onDeleteExpense={id=>{setActionError('');setDeleting(data.tripExpenses.find(e=>e.id===id))}} onPage={setPage}/>
  return <PeopleContext.Provider value={data.people}>
    <AppShell page={page} setPage={setPage} trips={data.trips} activeTrip={data.activeTrip} pendingCount={data.submissions.filter(e=>e.status==='pending').length} setActiveTripId={id=>{data.setActiveTripId(id);setActionError('')}} onCreateTrip={()=>openModal('trip')} onSignOut={endSession} profileName={session.name} onHelp={()=>openModal('help')} onSettings={()=>openModal('settings')} onActivity={()=>setPage('Dashboard')}>
      {data.error&&data.activeTrip&&<div className="form-error" role="alert">{data.error} <button onClick={()=>data.refresh().catch(()=>{})}>Retry</button></div>}{content}
    </AppShell>
    {modal==='expense'&&data.activeTrip&&<ExpenseModal trip={data.activeTrip} expense={editing} onSave={saveExpense} onClose={closeModal} busy={busy}/>}
    {modal==='endTrip'&&data.activeTrip?.isOwner&&<ModalFrame eyebrow="MANAGE TRIP" title="End this trip?" onClose={closeModal}><div className="workflow-note"><b>{data.activeTrip.name}</b><p>Ending the trip locks expenses, approvals, and membership. Members can still settle outstanding payments. You can then generate a receipt and share it with the group.</p>{data.submissions.some(e=>e.status==='pending')&&<p role="alert">Review pending expense submissions before ending the trip.</p>}</div><div className="delete-confirm-actions"><button className="button button-outline" disabled={busy} onClick={closeModal}>Keep trip active</button><button className="button button-lime-dark" disabled={busy||data.submissions.some(e=>e.status==='pending')} onClick={()=>perform(()=>data.completeTrip(),'Trip ended. You can now generate its receipt.')}>{busy?'Ending…':'End trip and lock expenses'}</button></div></ModalFrame>}
    {modal==='deleteTrip'&&editing&&<DeleteTripModal trip={editing} onDelete={id=>perform(async()=>{await data.removeTrip(id);setPage('Dashboard')},'Trip deleted')} onClose={closeModal} busy={busy}/>}
    {modal==='trip'&&<TripModal profileId={session.id} onSave={saveTrip} onClose={closeModal} busy={busy}/>}
    {modal==='members'&&data.activeTrip?.isOwner&&<MembersModal trip={data.activeTrip} profileId={session.id} onSave={ids=>perform(()=>data.addMembers(ids),'Members added to the trip')} onClose={closeModal} busy={busy}/>}
    {modal==='invite'&&data.activeTrip&&<InviteModal trip={data.activeTrip} onClose={closeModal} onCopied={()=>notify('Trip link copied')}/>}
    {modal==='payment'&&data.activeTrip&&<PaymentModal transfer={editing} currency={data.activeTrip.currency} onSave={savePayment} onClose={closeModal} busy={busy}/>}
    {modal==='help'&&<ModalFrame title="How FairSplit works" onClose={closeModal}><p>Create your account, then create a trip to become its manager or join a trip as a member. Managers add existing accounts by email or share an invitation link.</p><p>Record who paid, including multiple contributors. Every expense splits equally across the group. Members submit expenses to the manager; pending and rejected expenses do not affect balances.</p><p>Send money outside FairSplit and record it from your own account. Only the recipient can confirm receipt. Managers cannot confirm for someone else. Old offline guest records remain in the ledger but cannot record or confirm payments without their own account.</p></ModalFrame>}
    {modal==='settings'&&<ModalFrame title="Your account" onClose={closeModal}><p><b>{session.name}</b></p><p>{session.email}</p><p>Trips use PKR. Your session lasts seven days. Use “Forgot password?” on the sign-in screen to change your password.</p><button className="button button-outline" disabled={busy} onClick={endSession}>Sign out</button></ModalFrame>}
    {deleting&&<ModalFrame eyebrow="TRIP LEDGER" title="Remove this expense?" onClose={closeModal}><div className="delete-confirm-copy"><b>{deleting.title}</b><span>Everyone’s balances will update. Confirmed payments stay in the trip history.</span></div><div className="delete-confirm-actions"><button className="button button-outline" disabled={busy} onClick={closeModal}>Keep expense</button><button className="button button-danger" disabled={busy} onClick={()=>perform(()=>data.removeExpense(deleting.id),'Expense removed')}>Remove expense</button></div></ModalFrame>}
    {actionError&&<div className="action-error" role="alert">{actionError}<button aria-label="Dismiss error" onClick={()=>setActionError('')}><X size={16}/></button></div>}
    {notice&&<div className="toast-message" role="status"><span><Check size={15}/></span>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
  </PeopleContext.Provider>
}
