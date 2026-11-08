import { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import ExpenseList from '../components/ExpenseList'
import SectionTitle from '../components/SectionTitle'
import { money } from '../utils/finance'

export default function ExpensesPage({ trip, expenses, onAddExpense, onEditExpense, onDeleteExpense }) {
  const searchInput = useRef(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [sortOrder, setSortOrder] = useState('newest')
  useEffect(() => {
    const focusSearch = () => searchInput.current?.focus()
    window.addEventListener('fairsplit:focus-expense-search', focusSearch)
    return () => window.removeEventListener('fairsplit:focus-expense-search', focusSearch)
  }, [])
  const filtered = useMemo(() => expenses
    .filter(item => item.title.toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || item.category === category))
    .sort((a, b) => sortOrder === 'newest' ? (b.date || '').localeCompare(a.date || '') : (a.date || '').localeCompare(b.date || '')), [expenses, query, category, sortOrder])
  const total = filtered.reduce((sum, item) => sum + item.amount, 0)
  return <div className="page-stack page-enter">
    <div className="page-topline"><span className="eyebrow">THE TRIP LEDGER</span><span className="page-count-pill">{expenses.length} receipts & memories</span></div>
    <SectionTitle title="Expense history" description="A clear record of who paid, and who shared." action={trip.status!=='completed'&&<button className="button button-lime-dark" onClick={onAddExpense}><Plus size={16}/> Add an expense</button>}/>
    <section className="ledger-summary"><div><span>Showing</span><b>{filtered.length} <small>expenses</small></b></div><i/><div><span>Filtered total</span><b>{money(total, trip.currency)}</b></div><div className="ledger-decoration"><span/><span/><span/><span/><span/><span/></div></section>
    <div className="filter-bar"><div className="filter-search"><Search size={16}/><input ref={searchInput} aria-label="Search expenses" placeholder="Search by expense name..." value={query} onChange={event => setQuery(event.target.value)}/>{query && <button onClick={() => setQuery('')}>Clear</button>}</div><label className="filter-select"><Filter size={15}/><select value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{['Stay','Food','Transport','Groceries','Activities','Other'].map(item=><option key={item}>{item}</option>)}</select></label><button type="button" className="filter-sort" aria-label="Sort expenses by date" aria-pressed={sortOrder==='oldest'} onClick={()=>setSortOrder(value=>value==='newest'?'oldest':'newest')}><SlidersHorizontal size={15}/>{sortOrder==='newest'?'Newest first':'Oldest first'}</button></div>
    <ExpenseList expenses={filtered} currency={trip.currency} onEdit={onEditExpense} onDelete={onDeleteExpense} full/>
    <div className="ledger-footnote"><span>✦</span> Your expense history is saved to your trip.</div>
  </div>
}
