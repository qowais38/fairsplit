export const people = [
  { id: 'ali', name: 'Ali Khan', initials: 'AK', tone: 'sage' },
  { id: 'sara', name: 'Sara Ahmed', initials: 'SA', tone: 'lilac' },
  { id: 'ahmed', name: 'Ahmed Raza', initials: 'AR', tone: 'peach' },
  { id: 'you', name: 'Maya Kim', initials: 'MK', tone: 'blue' },
]

export const demoTrips = [
  { id: 'tahoe', name: 'Lake Tahoe', location: 'California', startDate: '2026-10-19', endDate: '2026-10-23', currency: 'PKR', members: ['you','sara','ahmed','ali'], status: 'active' },
  { id: 'yosemite', name: 'Yosemite weekend', location: 'California', startDate: '2026-09-12', endDate: '2026-09-14', currency: 'PKR', members: ['you','sara','ahmed'], status: 'completed' },
]

const rows = [
  ['Cabin by the lake','Stay',68000,'ali',['ali','sara','ahmed','you'],'2026-10-20'],
  ['Dinner at Pine & Salt','Food',14600,'sara',['sara','ahmed','you'],'2026-10-20'],
  ['Gas & tolls','Transport',9200,'ahmed',['ali','sara','ahmed','you'],'2026-10-20'],
  ['Farmers market','Groceries',7400,'you',['ali','sara','ahmed','you'],'2026-10-20'],
  ['Kayak rental','Activities',12000,'ali',['ali','sara','you'],'2026-10-19'],
  ['Breakfast & coffee','Food',6200,'sara',['ali','sara','ahmed','you'],'2026-10-19'],
  ['Trailhead parking','Transport',3800,'you',['ali','sara','ahmed','you'],'2026-10-19'],
  ['Groceries for the cabin','Groceries',9100,'ahmed',['ali','sara','ahmed','you'],'2026-10-19'],
  ['Lake access permits','Activities',2800,'ali',['ali','sara','ahmed','you'],'2026-10-19'],
  ['Pizza after the hike','Food',5300,'you',['sara','ahmed','you'],'2026-10-18'],
  ['Coffee stop','Food',2400,'sara',['sara','you'],'2026-10-18'],
  ['Boat rental','Activities',16800,'ali',['ali','sara','ahmed','you'],'2026-10-18'],
  ['Road trip snacks','Groceries',3450,'ahmed',['ahmed','you'],'2026-10-18'],
  ['Sunset dinner','Food',18400,'you',['ali','sara','you'],'2026-10-18'],
  ['Extra night parking','Transport',2600,'ahmed',['ali','ahmed','you'],'2026-10-17'],
]

function evenShares(amount, ids) {
  const base = Math.floor(amount / ids.length)
  const centsLeft = amount % ids.length
  return Object.fromEntries(ids.map((id, index) => [id, base + (index < centsLeft ? 1 : 0)]))
}

export const demoExpenses = rows.map(([title, category, amount, payer, participants, date], index) => {
  const shares = evenShares(amount, participants)
  if (title === 'Sunset dinner') Object.assign(shares, { ali: 7200, sara: 5600, you: 5600 })
  return { id: `demo-${index + 1}`, tripId: 'tahoe', title, category, amount, payer, people: participants, shares, splitType: title === 'Sunset dinner' ? 'custom' : 'equal', date }
})
