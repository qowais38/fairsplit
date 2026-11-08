import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBalances, getTransfers } from '../utils/finance'
import { api } from '../services/api'

const empty = { trips: [], expenses: [], settlements: [], people: [] }
export function useFairSplit(session) {
  const [state, setState] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTripId, setActiveTripId] = useState(null)
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try { const next = await api('/state'); if (request === sequence.current) { setState(next); setError('') } }
    catch (err) { if (request === sequence.current) setError(err.message); throw err }
    finally { if (request === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => {
    setState(empty); setLoading(!!session); setError(''); setActiveTripId(null)
    if (!session) return
    refresh().catch(() => {})
    const update = () => { if (!document.hidden) refresh().catch(() => {}) }
    const timer = setInterval(update, 15000)
    window.addEventListener('focus', update)
    return () => { sequence.current++; clearInterval(timer); window.removeEventListener('focus', update) }
  }, [session?.id, refresh])
  const { trips, expenses, settlements, people } = state
  const activeTrip = trips.find(trip => trip.id === activeTripId) || trips[0]
  const tripExpenses = useMemo(() => expenses.filter(item => item.tripId === activeTrip?.id && item.status === 'approved').sort((a,b) => b.date.localeCompare(a.date)), [expenses, activeTrip?.id])
  const submissions = expenses.filter(item => item.tripId === activeTrip?.id && item.status !== 'approved')
  const balances = useMemo(() => activeTrip ? getBalances(activeTrip, expenses, settlements) : [], [activeTrip, expenses, settlements])
  const transfers = useMemo(() => {
    const planning = balances.map(item => ({ ...item }))
    settlements.filter(item => item.tripId === activeTrip?.id && item.status === 'awaiting').forEach(item => {
      const from = planning.find(b => b.id === item.from), to = planning.find(b => b.id === item.to)
      if (from) from.balance += item.amount
      if (to) to.balance -= item.amount
    })
    return getTransfers(planning)
  }, [balances, settlements, activeTrip?.id])
  async function mutate(path, method, body) {
    const result = await api(path, { method, body })
    // The write succeeded even if a later refresh fails; never invite duplicate submissions.
    await refresh().catch(() => {})
    return result
  }
  const base = `/trips/${activeTrip?.id}`
  return {
    trips, activeTrip, activeTripId, setActiveTripId, people, loading, error, refresh, submissions,
    allExpenses: expenses, allSettlements: settlements,
    tripExpenses, balances, transfers, settlements: settlements.filter(item => item.tripId === activeTrip?.id),
    total: tripExpenses.reduce((sum,item) => sum + item.amount,0),
    saveExpense: data => mutate(`${base}/expenses${data.id ? `/${data.id}` : ''}`, data.id ? 'PUT' : 'POST', data),
    removeExpense: id => mutate(`${base}/expenses/${id}`, 'DELETE'),
    reviewExpense: (expense, decision) => mutate(`${base}/expenses/${expense.id}/review`, 'POST', { decision, version: expense.version }),
    completeTrip: () => mutate(`${base}/complete`, 'POST'),
    generateReceipt: () => mutate(`${base}/receipts`, 'POST'),
    addMembers: memberIds => mutate(`${base}/members`, 'POST', { memberIds }),
    createTrip: async data => { const trip = await mutate('/trips', 'POST', data); setActiveTripId(trip.id); return trip },
    removeTrip: async id => {
      await api(`/trips/${id}`, { method: 'DELETE' })
      sequence.current++
      setState(current => ({ ...current, trips: current.trips.filter(t => t.id !== id), expenses: current.expenses.filter(e => e.tripId !== id), settlements: current.settlements.filter(p => p.tripId !== id) }))
      setActiveTripId(current => current === id ? null : current)
      await refresh().catch(() => {})
    },
    recordPayment: (transfer, amount) => mutate(`${base}/settlements`, 'POST', { from: transfer.from, to: transfer.to, amount }),
    confirmPayment: id => mutate(`${base}/settlements/${id}/confirm`, 'POST'),
    cancelPayment: id => mutate(`${base}/settlements/${id}/cancel`, 'POST'),
    joinTrip: async token => { const trip = await mutate('/invites/join', 'POST', { token }); setActiveTripId(trip.id); return trip },
  }
}
