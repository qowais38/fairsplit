export const money = (cents, currency = 'PKR') => new Intl.NumberFormat('en-PK', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)
export const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'
export const equalShares = (amount, ids) => {
  if (!ids.length) return {}
  const base = Math.floor(amount / ids.length)
  const remainder = amount % ids.length
  return Object.fromEntries(ids.map((id, index) => [id, base + (index < remainder ? 1 : 0)]))
}
export function getBalances(trip, expenses, settlements) {
  const balances = Object.fromEntries(trip.members.map(id => [id, 0]))
  expenses.filter(item => item.tripId === trip.id && (!item.status || item.status === 'approved')).forEach(item => {
    Object.entries(item.contributions || { [item.payer]: item.amount }).forEach(([id, amount]) => { balances[id] = (balances[id] || 0) + amount })
    Object.entries(item.shares).forEach(([id, share]) => { balances[id] = (balances[id] || 0) - share })
  })
  settlements.filter(item => item.tripId === trip.id && item.status === 'confirmed').forEach(item => {
    balances[item.from] = (balances[item.from] || 0) + item.amount
    balances[item.to] = (balances[item.to] || 0) - item.amount
  })
  return Object.entries(balances).map(([id, balance]) => ({ id, balance }))
}
export function getTransfers(balances) {
  const owes = balances.filter(item => item.balance < 0).map(item => ({ id: item.id, amount: -item.balance })).sort((a,b) => b.amount-a.amount)
  const gets = balances.filter(item => item.balance > 0).map(item => ({ id: item.id, amount: item.balance })).sort((a,b) => b.amount-a.amount)
  const transfers = []; let debtor = 0; let creditor = 0
  while (debtor < owes.length && creditor < gets.length) {
    const amount = Math.min(owes[debtor].amount, gets[creditor].amount)
    transfers.push({ from: owes[debtor].id, to: gets[creditor].id, amount })
    owes[debtor].amount -= amount; gets[creditor].amount -= amount
    if (!owes[debtor].amount) debtor++
    if (!gets[creditor].amount) creditor++
  }
  return transfers
}
