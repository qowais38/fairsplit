import { usePeople } from '../hooks/usePeople'
import { useState } from 'react'
import { BedDouble, CarFront, MoreHorizontal, Pencil, ShoppingBasket, Sparkles, Trash2, Utensils, Waves } from 'lucide-react'
import Avatar from './ui/Avatar'
import { formatDate, money } from '../utils/finance'

const categoryIcon = { Stay: BedDouble, Food: Utensils, Transport: CarFront, Groceries: ShoppingBasket, Activities: Waves, Other: Sparkles }

export default function ExpenseList({ expenses, currency = 'PKR', onEdit, onDelete, full = false }) {
  const people = usePeople()
  const [openMenu, setOpenMenu] = useState(null)
  return <div className={`expense-list-card ${full ? 'expense-list-full' : ''}`}>
    {!full && <div className="expense-list-head"><div><h2>Recent expenses</h2><p>The little details that make a trip.</p></div><span className="list-count">{expenses.length} shown</span></div>}
    <div className="expense-table-head"><span>EXPENSE</span><span>SHARED WITH</span><span>PAID BY</span><span>AMOUNT</span><span/></div>
    {expenses.length ? expenses.map((expense, index) => {
      const Icon = categoryIcon[expense.category] || Sparkles
      return <article className={`expense-row ${openMenu === expense.id ? 'menu-open' : ''}`} key={expense.id} style={{ '--row-index': index }}>
        <span className={`expense-category-icon category-${expense.category.toLowerCase()}`}><Icon size={17}/></span>
        <div className="expense-info"><b>{expense.title}</b><span>{expense.category}<i/>{formatDate(expense.date)}</span></div>
        <div className="expense-shared">{expense.people.map(id => <Avatar key={id} id={id} size="xs"/>)}</div>
        <div className="expense-paid" title={Object.entries(expense.contributions || { [expense.payer]: expense.amount }).map(([id,n])=>`${id==='you'?'You':people.find(p=>p.id===id)?.name}: ${money(n,currency)}`).join(', ')}><Avatar id={expense.payer} size="xs"/><span>{Object.keys(expense.contributions || {}).length>1?`${Object.keys(expense.contributions).length} payers`:expense.payer === 'you' ? 'You' : people.find(p => p.id === expense.payer)?.name}</span></div>
        <strong className="expense-amount">{money(expense.amount, currency)}</strong>
        <div className="expense-menu-wrap">{(expense.canEdit || expense.canDelete)&&<button className="row-menu-trigger" aria-label={`Options for ${expense.title}`} onClick={() => setOpenMenu(openMenu === expense.id ? null : expense.id)}><MoreHorizontal size={18}/></button>}{openMenu === expense.id && <div className="row-menu">{expense.canEdit&&<button onClick={() => { onEdit(expense); setOpenMenu(null) }}><Pencil size={13}/> Edit expense</button>}{expense.canDelete&&<button onClick={() => { onDelete(expense.id); setOpenMenu(null) }}><Trash2 size={13}/> Remove</button>}</div>}</div>
      </article>
    }) : <div className="empty-inline">No expenses match those filters.</div>}
  </div>
}
