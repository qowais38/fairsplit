import { useEffect } from 'react'
import { ArrowDownLeft, Bell, ChevronDown, CircleHelp, Home, Plus, ReceiptText, Search, Settings, Sparkles, Users, Wallet } from 'lucide-react'
import Avatar from '../components/ui/Avatar'

const nav = [
  { id: 'Dashboard', label: 'Dashboard', icon: Home },
  { id: 'Approvals', label: 'Approvals', icon: ReceiptText },
  { id: 'Overview', label: 'Overview', icon: Home },
  { id: 'Expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'Balances', label: 'Balances', icon: Wallet },
  { id: 'Settle up', label: 'Settle up', icon: ArrowDownLeft },
]

export default function AppShell({ pendingCount = 0, page, setPage, trips, activeTrip, setActiveTripId, onCreateTrip, onSignOut, profileName = '', onHelp, onSettings, onActivity, children }) {
  const navigation = nav.map(item => item.id === 'Approvals' ? { ...item, label: `${activeTrip?.isOwner ? 'Approvals' : 'My submissions'}${pendingCount ? ` (${pendingCount})` : ''}` } : item)
  useEffect(() => {
    function openExpenseSearch() {
      setPage('Expenses')
      requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('fairsplit:focus-expense-search'))))
    }
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openExpenseSearch()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [setPage])
  function openExpenseSearch() {
    setPage('Expenses')
    requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('fairsplit:focus-expense-search'))))
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={event => { event.preventDefault(); setPage('Dashboard') }}>
        <span className="brand-mark"><i/><i/><i/><i/></span><span>fair<span>split</span></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="primary-nav">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}><Icon size={18}/><span>{label}</span>{id === 'Settle up' && <span className="nav-spark"><Sparkles size={12}/></span>}</button>)}</nav>
      <div className="sidebar-section"><div className="section-label">YOUR TRIPS <button aria-label="Create trip" onClick={onCreateTrip}><Plus size={15}/></button></div>
        <div className="trip-list">{trips.map((trip, index) => <button key={trip.id} className={`trip-item ${trip.id === activeTrip?.id ? 'selected' : ''}`} onClick={() => { setActiveTripId(trip.id); setPage('Overview') }}><span className={`trip-thumb trip-thumb-${index % 3}`}>{index % 2 ? '🌲' : '🏞️'}</span><span className="trip-name">{trip.name}</span>{trip.status === 'active' && <i className="trip-active-dot"/>}</button>)}</div>
        <button className="new-trip-link" onClick={onCreateTrip}><Plus size={15}/> Create a trip</button>
      </div>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span><Sparkles size={14}/></span><b>Good trips, better splits.</b><small>Keep every shared cost clear.</small></div><button className="utility-link" onClick={onHelp}><CircleHelp size={17}/><span>Help & support</span></button><button className="utility-link" onClick={onSettings}><Settings size={17}/><span>Settings</span></button><button className="profile" type="button" onClick={onSignOut} aria-label="Sign out"><Avatar id="you" size="md"/><span className="profile-copy"><b>{profileName}</b><small>{activeTrip?.isOwner ? 'Trip manager' : 'Member account'} · Sign out</small></span><ChevronDown size={15}/></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><i/><i/><i/><i/></span>fair<span>split</span></div><div className="breadcrumbs"><span>My trips</span><span className="crumb-slash">/</span><b>{page==='Dashboard'?'Your dashboard':activeTrip?.name}</b><span className="trip-status"><i/>{activeTrip?.status === 'completed' ? 'Completed' : 'In progress'}</span></div><div className="top-actions"><button className="icon-button search-shortcut" title="Search expenses" aria-label="Search expenses" onClick={openExpenseSearch}><Search size={17}/><span>Search</span><kbd>Ctrl K</kbd></button><button className="icon-button notification-button" title="Your dashboard and activity" aria-label="Your dashboard and activity" onClick={onActivity}><Bell size={18}/>{pendingCount>0&&<i/>}</button><button className="top-profile-button" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><Avatar id="you" size="sm"/></button></div></header>
      <div className="mobile-workspace"><select aria-label="Choose trip" value={activeTrip?.id||''} onChange={event=>{setActiveTripId(event.target.value);setPage('Overview')}}>{!trips.length&&<option value="">Your trips</option>}{trips.map(trip=><option key={trip.id} value={trip.id}>{trip.name}</option>)}</select><button className="button button-outline" onClick={onCreateTrip}><Plus size={15}/> New trip</button></div>
      <div className="page-content">{children}</div></main>
    <nav className="mobile-nav">{navigation.map(({id,label,icon:Icon})=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
  </div>
}
