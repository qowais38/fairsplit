const express = require('express')
const cors = require('cors')
const { randomUUID, randomBytes, createHash, scrypt, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')
const { resolve } = require('node:path')
const { openDatabase } = require('./database')
const { makeReceipt, renderReceipt } = require('./receipt')
const derive = promisify(scrypt)
const hash = value => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('hex')
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const text = (value, label, max = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${label} is required (maximum ${max} characters).`)
  return value.trim()
}
const cents = value => { if (!Number.isSafeInteger(value) || value < 1 || value > 100000000) fail(400, 'Amount must be between PKR 0.01 and PKR 1,000,000.'); return value }
const date = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(400, 'Enter a valid date.'); return value }
function passwordInput(value) { if (typeof value !== 'string' || value.length < 8 || value.length > 128) fail(400, 'Password must contain 8–128 characters.'); return value }
async function passwordHash(value) { const salt = token(); return `${salt}:${(await derive(value, salt, 64)).toString('hex')}` }
async function passwordMatches(value, encoded) { const [salt, key] = encoded.split(':'); return timingSafeEqual(await derive(value, salt, 64), Buffer.from(key, 'hex')) }

async function createApp(options = {}) {
  const db = await openDatabase(options.database), app = express()
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:5173'
  const transaction = fn => db.transaction(fn)
  async function findSessionUser(req) {
    const entry = await db.findOne('sessions', { token: hash(sessionToken(req)), expires: { $gt: Date.now() } })
    return entry ? db.findOne('users', { id: entry.user_id }) : null
  }
  async function findAccessibleTrip(id, userId) {
    if (!await db.findOne('members', { trip_id: id, user_id: userId })) return null
    return db.findOne('trips', { id })
  }
  async function insertGuests(guests, tripId) {
    for (const name of guests) await db.insert('members', { id: randomUUID(), trip_id: tripId, user_id: null, name })
  }
  // Lock the trip document before reading its ledger. Transaction retries then
  // recheck balances and versions when concurrent requests modify the same trip.
  function tripRoute(method, path, handler) {
    app[method](path, async (req, res) => {
      const result = await db.transaction(async () => {
        let id = req.params.id
        if (path === '/api/invites/join') id = (await db.findOne('invites', { token: hash(text(req.body.token, 'Invitation', 128)) }))?.trip_id
        if (id) await db.update('trips', { id }, { $inc: { revision: 1 } })
        let body, status = 200
        const response = { status(code) { status = code; return this }, json(value) { body = value; return this } }
        await handler(req, response)
        return { body, status }
      })
      res.status(result.status).json(result.body)
    })
  }
  app.disable('x-powered-by')
  app.use(cors({ origin, credentials: true }))
  app.use(express.json({ limit: '64kb' }))
  app.use('/api', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== origin) return res.status(403).json({ error: 'Request origin is not allowed.' })
    if (!['GET','HEAD','OPTIONS','DELETE'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: 'Send a JSON request.' })
    if (!['GET','HEAD','OPTIONS','DELETE'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'Send a JSON object.' })
    next()
  })
  const attempts = new Map()
  app.use('/api/auth', (req, res, next) => {
    if (req.method === 'GET') return next()
    const now = Date.now()
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key)
    const entry = attempts.get(req.ip) || { count: 0, until: now + 900000 }
    entry.count++; attempts.set(req.ip, entry)
    if (entry.count > (options.authLimit || 40)) return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' })
    next()
  })
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }
  const sessionToken = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('fairsplit_session='))?.slice('fairsplit_session='.length) || ''
  async function session(req, res, user) {
    await db.remove('sessions', { expires: { $lt: Date.now() } })
    await db.remove('sessions', { token: hash(sessionToken(req)) })
    const value = token()
    await db.insert('sessions', { token: hash(value), user_id: user.id, expires: Date.now() + 7 * 86400000 })
    res.cookie('fairsplit_session', value, { ...cookieOptions, maxAge: 7 * 86400000 })
    return { id: user.id, name: user.name, email: user.email }
  }
  const emailInput = value => { const email = text(value, 'Email', 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email.'); return email }
  app.get('/api/health', async (req,res) => res.json({ status: 'ok' }))
  app.post('/api/auth/signup', async (req,res) => {
    const email = emailInput(req.body.email), name = text(req.body.name, 'Name', 80)
    const password = await passwordHash(passwordInput(req.body.password))
    if (await db.findOne('users', { email })) fail(409, 'An account with this email already exists.')
    const user = { id: randomUUID(), name, email }
    await db.insert('users', { ...user, password })
    res.status(201).json({ user: await session(req, res, user) })
  })
  app.post('/api/auth/login', async (req,res) => {
    const email = emailInput(req.body.email), password = passwordInput(req.body.password)
    const user = await db.findOne('users', { email })
    const fallback = `${'0'.repeat(64)}:${'0'.repeat(128)}`
    if (!(await passwordMatches(password, user?.password || fallback)) || !user) fail(401, 'Email or password is incorrect.')
    res.json({ user: await session(req, res, user) })
  })
  app.post('/api/auth/logout', async (req,res) => { await db.remove('sessions', { token: hash(sessionToken(req)) }); res.clearCookie('fairsplit_session', cookieOptions).json({ ok: true }) })
  app.post('/api/auth/forgot', async (req,res) => {
    const email = emailInput(req.body.email)
    if (!options.sendReset && !process.env.SMTP_HOST) fail(503, 'Password reset email is not configured. Contact the administrator.')
    const user = await db.findOne('users', { email })
    if (user) {
      const value = token()
      await db.insert('resets', { token: hash(value), user_id: user.id, expires: Date.now() + 1800000 })
      const url = `${origin}/?reset=${value}`
      try {
        if (options.sendReset) await options.sendReset(email, url)
        else {
          const mailer = require('nodemailer').createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}) })
          await mailer.sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your FairSplit password', text: `Reset your password within 30 minutes: ${url}\nIf you did not request this, ignore this email.` })
        }
      } catch (error) { await db.remove('resets', { token: hash(value) }); console.error('Password reset email delivery failed'); }
    }
    res.json({ message: 'If this account exists, a password reset email has been requested.' })
  })
  app.post('/api/auth/reset', async (req,res) => {
    const value = text(req.body.token, 'Reset token', 128)
    const password = await passwordHash(passwordInput(req.body.password))
    await transaction(async () => {
      const reset = await db.findOne('resets', { token: hash(value), expires: { $gt: Date.now() } })
      if (!reset) fail(400, 'This reset link is invalid or expired.')
      await db.update('users', { id: reset.user_id }, { $set: { password } })
      await db.remove('resets', { user_id: reset.user_id })
      await db.remove('sessions', { user_id: reset.user_id })
    })
    res.clearCookie('fairsplit_session', cookieOptions).json({ ok: true })
  })
  app.use('/api', async (req,res,next) => {
    req.user = await findSessionUser(req)
    if (!req.user) {
      const receiptPath = req.method === 'GET' && req.path.match(/^\/trips\/([^/]+)\/receipts\/([^/]+)$/)
      if (receiptPath) return res.redirect(`${origin}/?receiptTrip=${encodeURIComponent(receiptPath[1])}&receipt=${encodeURIComponent(receiptPath[2])}`)
      return res.status(401).json({ error: 'Please sign in to continue.' })
    }
    next()
  })
  app.get('/api/auth/me', async (req,res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } }))
  async function tripAccess(id, user) {
    const trip = await findAccessibleTrip(id, user.id)
    if (!trip) fail(404, 'Trip not found.')
    return { ...trip.data, id: trip.id, owner: trip.owner, members: await db.find('members', { trip_id: id }) }
  }
  const realId = (id, user) => id === 'you' ? user.id : id
  const viewId = (id, user) => id === user.id ? 'you' : id
  async function ledger(table, id) { return (await db.find(table, { trip_id: id })).map(row => row.data) }
  async function balances(trip, includePending = false) {
    const result = Object.fromEntries(trip.members.map(m => [m.id, 0]))
    for (const expense of (await ledger('expenses', trip.id))) {
      if (expense.status && expense.status !== 'approved') continue
      for (const [id, amount] of Object.entries(expense.contributions || { [expense.payer]: expense.amount })) result[id] += amount
      for (const [id, share] of Object.entries(expense.shares)) result[id] -= share
    }
    for (const payment of (await ledger('settlements', trip.id))) if (payment.status === 'confirmed' || (includePending && payment.status === 'awaiting')) { result[payment.from] += payment.amount; result[payment.to] -= payment.amount }
    return result
  }
  function mayAct(trip, id, user) { return trip.members.find(m => m.id === id)?.user_id === user.id }
  const approved = expense => !expense.status || expense.status === 'approved'
  function requireActive(trip) { if (trip.status === 'completed') fail(409, 'This trip has ended. Expenses and membership are locked; repayments can still be settled.') }
  app.get('/api/users/lookup', async (req, res) => {
    const email = emailInput(req.query.email)
    const user = await db.findOne('users', { email })
    if (!user) fail(404, 'No account found. Ask this person to create an account first.')
    res.json({ user: { id: user.id, name: user.name, email: user.email } })
  })
  app.get('/api/state', async (req,res) => {
    const user = req.user, vid = id => viewId(id, user)
    const trips = await Promise.all((await db.find('members', { user_id: user.id })).map(row => tripAccess(row.trip_id, user)))
    const people = new Map([[user.id, { id: 'you', name: user.name }]])
    const expenses = [], settlements = []
    for (const trip of trips) {
      trip.members.forEach(m => people.set(m.id, { id: vid(m.id), name: m.name }))
      expenses.push(...(await ledger('expenses', trip.id)).filter(e => approved(e) || trip.owner === user.id || e.submittedBy === user.id).map(e => ({ ...e, status: e.status || 'approved', submittedBy: e.submittedBy ? vid(e.submittedBy) : null, canReview: trip.status !== 'completed' && trip.owner === user.id && e.status === 'pending', canEdit: trip.status !== 'completed' && (trip.owner === user.id || (e.submittedBy === user.id && !approved(e))), canDelete: trip.status !== 'completed' && (trip.owner === user.id || (e.submittedBy === user.id && !approved(e))), payer: vid(e.payer), contributions: Object.fromEntries(Object.entries(e.contributions || { [e.payer]: e.amount }).map(([id,n]) => [vid(id),n])), people: e.people.map(vid), shares: Object.fromEntries(Object.entries(e.shares).map(([id,n]) => [vid(id),n])) })))
      settlements.push(...(await ledger('settlements', trip.id)).map(p => ({ ...p, from: vid(p.from), to: vid(p.to), canConfirm: mayAct(trip, p.to, user), canCancel: mayAct(trip, p.from, user) || mayAct(trip, p.to, user) })))
      trip.recordableMembers = trip.members.filter(m => mayAct(trip, m.id, user)).map(m => vid(m.id))
      trip.managerName = trip.members.find(m => m.user_id === trip.owner)?.name || 'Trip manager'
      const [latest] = await db.find('receipts', { trip_id: trip.id }, { projection: { id: 1, generatedAt: 1, 'data.number': 1 }, sort: { generatedAt: -1, _id: -1 }, limit: 1 })
      trip.receipt = latest ? { id: latest.id, number: latest.data.number, generatedAt: latest.generatedAt } : null
      trip.memberDetails = trip.members.map(m => ({ id: vid(m.id), name: m.name, hasAccount: !!m.user_id, isManager: m.user_id === trip.owner }))
      trip.members = trip.members.map(m => vid(m.id)); trip.isOwner = trip.owner === user.id; delete trip.owner
    }
    res.json({ trips, expenses, settlements, people: [...people.values()].map((p,i) => ({ ...p, initials: p.name.split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase(), tone: ['blue','sage','lilac','peach'][i%4] })) })
  })
  tripRoute('post', '/api/trips', async (req,res) => {
    const body = req.body
    const data = { name: text(body.name, 'Trip name', 80), location: typeof body.location === 'string' ? body.location.trim().slice(0,120) : '', startDate: body.startDate ? date(body.startDate) : '', endDate: body.endDate ? date(body.endDate) : '', currency: 'PKR', status: 'active' }
    if (data.startDate && data.endDate && data.endDate < data.startDate) fail(400, 'End date must be after start date.')
    if (!Array.isArray(body.guestNames) || body.guestNames.length > 30) fail(400, 'Provide up to 30 guest names.')
    const guests = body.guestNames.map(name => text(name, 'Guest name', 80)), id = randomUUID()
    const accounts = await selectedAccounts(body.memberIds || [], req.user.id)
    await transaction(async () => { await db.insert('trips', { id, owner: req.user.id, data }); await db.insert('members', { id: req.user.id, trip_id: id, user_id: req.user.id, name: req.user.name }); await insertGuests(guests, id); for (const user of accounts) await addAccount(id, user) })
    res.status(201).json({ id })
  })
  tripRoute('delete', '/api/trips/:id', async (req, res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip manager can delete this trip.')
    // All related records are removed in the route's transaction, or none are.
    for (const collection of ['receipts', 'invites', 'expenses', 'settlements', 'members']) await db.remove(collection, { trip_id: trip.id })
    await db.remove('trips', { id: trip.id })
    res.json({ ok: true })
  })
  async function selectedAccounts(ids, owner) {
    if (!Array.isArray(ids) || ids.length > 30 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) fail(400, 'Choose up to 30 different registered members.')
    const result = []
    for (const id of ids) {
      if (id === owner) continue
      const user = await db.findOne('users', { id })
      if (!user) fail(400, 'A selected member account no longer exists.')
      result.push(user)
    }
    return result
  }
  async function addAccount(tripId, user) {
    await db.update('members', { trip_id: tripId, user_id: user.id }, { $setOnInsert: { id: user.id, name: user.name } }, { upsert: true })
  }
  tripRoute('post', '/api/trips/:id/members', async (req, res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip manager can add members.')
    requireActive(trip)
    const accounts = await selectedAccounts(req.body.memberIds, req.user.id)
    for (const user of accounts) await addAccount(trip.id, user)
    res.json({ ok: true })
  })
  tripRoute('post', '/api/trips/:id/invites', async (req,res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip creator can create invitations.')
    requireActive(trip)
    const value = token(), expires = Date.now() + 7 * 86400000
    await transaction(async () => { await db.remove('invites', { trip_id: trip.id }); await db.insert('invites', { token: hash(value), trip_id: trip.id, expires }) })
    res.status(201).json({ url: `${origin}/?invite=${value}`, expires })
  })
  tripRoute('post', '/api/invites/join', async (req,res) => {
    const value = text(req.body.token, 'Invitation', 128)
    const invite = await db.findOne('invites', { token: hash(value), expires: { $gt: Date.now() } })
    if (!invite) fail(404, 'Invitation is invalid or expired. Ask for a new link.')
    const invitedTrip = await db.findOne('trips', { id: invite.trip_id })
    if (!invitedTrip) fail(404, 'Trip not found.')
    requireActive(invitedTrip.data)
    await db.update('members', { id: req.user.id, trip_id: invite.trip_id }, { $setOnInsert: { user_id: req.user.id, name: req.user.name } }, { upsert: true })
    res.json({ id: invite.trip_id })
  })
  function expenseData(body, trip, user) {
    const memberIds = trip.members.map(m => m.id), amount = cents(body.amount)
    const participants = memberIds
    const raw = body.contributions || { [body.payer || 'you']: amount }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > memberIds.length) fail(400, 'Provide who paid and how much.')
    const contributions = Object.fromEntries(Object.entries(raw).map(([id, value]) => [realId(id, user), value]))
    if (!Object.keys(contributions).length || Object.entries(contributions).some(([id, n]) => !memberIds.includes(id) || !Number.isSafeInteger(n) || n < 1 || n > amount) || Object.values(contributions).reduce((a,b) => a+b,0) !== amount || Object.keys(contributions).length !== Object.keys(raw).length) fail(400, 'Contributions must belong to trip members and exactly match the expense amount.')
    if (trip.owner !== user.id && !contributions[user.id]) fail(403, 'You can only submit an expense you contributed to.')
    const payer = Object.keys(contributions)[0]
    const shares = Object.fromEntries(participants.map((id,i) => [id, Math.floor(amount/participants.length) + (i < amount%participants.length ? 1 : 0)]))
    if (!['Stay','Food','Transport','Groceries','Activities','Other'].includes(body.category)) fail(400, 'Invalid category.')
    return { title: text(body.title,'Expense title'), amount, payer, contributions, people: participants, shares, splitType: 'equal', category: body.category, date: date(body.date) }
  }
  tripRoute('post', '/api/trips/:id/expenses', async (req,res) => {
    const trip = await tripAccess(req.params.id,req.user)
    requireActive(trip)
    const expense = { ...expenseData(req.body,trip,req.user), id: randomUUID(), tripId: trip.id, version: 1, submittedBy: req.user.id, createdAt: new Date().toISOString(), status: trip.owner === req.user.id ? 'approved' : 'pending' }
    await db.insert('expenses', { id: expense.id, trip_id: trip.id, data: expense })
    res.status(201).json({ id: expense.id, status: expense.status })
  })
  tripRoute('put', '/api/trips/:id/expenses/:expenseId', async (req,res) => {
    const trip = await tripAccess(req.params.id,req.user)
    requireActive(trip)
    const row = await db.findOne('expenses', { id: req.params.expenseId, trip_id: trip.id })
    if (!row) fail(404,'Expense not found.')
    const old = row.data
    if (trip.owner !== req.user.id && (old.submittedBy !== req.user.id || approved(old))) fail(403, 'Only the manager can change an approved expense. You can edit your own pending or rejected submissions.')
    if (old.version !== req.body.version) fail(409,'This expense changed. Refresh before editing again.')
    const expense = { ...old, ...expenseData(req.body,trip,req.user), version: old.version+1, updatedAt: new Date().toISOString(), status: approved(old) ? 'approved' : 'pending' }
    delete expense.reviewedBy; delete expense.reviewedAt
    await db.update('expenses', { id: old.id }, { $set: { data: expense } })
    res.json({ ok: true })
  })
  tripRoute('delete', '/api/trips/:id/expenses/:expenseId', async (req,res) => {
    const trip = await tripAccess(req.params.id,req.user)
    requireActive(trip)
    const row = await db.findOne('expenses', { id: req.params.expenseId, trip_id: trip.id })
    if (!row) fail(404, 'Expense not found.')
    if (trip.owner !== req.user.id && (row.data.submittedBy !== req.user.id || approved(row.data))) fail(403, 'Only the manager can remove an approved expense.')
    const result = await db.remove('expenses', { id: req.params.expenseId, trip_id: req.params.id })
    if (!result.deletedCount) fail(404,'Expense not found.')
    res.json({ ok: true })
  })
  tripRoute('post', '/api/trips/:id/expenses/:expenseId/review', async (req,res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip manager can review expenses.')
    requireActive(trip)
    if (!['approve', 'reject'].includes(req.body.decision)) fail(400, 'Choose approve or reject.')
    const row = await db.findOne('expenses', { id: req.params.expenseId, trip_id: trip.id })
    if (!row) fail(404, 'Expense not found.')
    if (row.data.status !== 'pending' || row.data.version !== req.body.version) fail(409, 'This submission changed or was already reviewed. Refresh before reviewing again.')
    const expense = { ...row.data, ...(req.body.decision === 'approve' ? expenseData(row.data, trip, req.user) : {}), status: req.body.decision === 'approve' ? 'approved' : 'rejected', reviewedBy: req.user.id, reviewedAt: new Date().toISOString(), version: row.data.version + 1 }
    await db.update('expenses', { id: expense.id }, { $set: { data: expense } })
    res.json({ ok: true })
  })
  tripRoute('post', '/api/trips/:id/complete', async (req,res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip manager can end this trip.')
    requireActive(trip)
    if ((await ledger('expenses',trip.id)).some(e => e.status === 'pending')) fail(409, 'Review all pending expense submissions before ending the trip.')
    const completedAt = new Date().toISOString()
    await db.update('trips', { id: trip.id }, { $set: { 'data.status': 'completed', 'data.completedAt': completedAt } })
    await db.remove('invites', { trip_id: trip.id })
    res.json({ ok: true, completedAt })
  })
  tripRoute('post', '/api/trips/:id/receipts', async (req,res) => {
    const trip = await tripAccess(req.params.id, req.user)
    if (trip.owner !== req.user.id) fail(403, 'Only the trip manager can generate a receipt.')
    if (trip.status !== 'completed') fail(409, 'End the trip before generating its receipt.')
    const receipt = makeReceipt(trip, await ledger('expenses',trip.id), await ledger('settlements',trip.id))
    await db.insert('receipts', { id: receipt.id, trip_id: trip.id, generatedAt: receipt.generatedAt, data: receipt })
    res.status(201).json({ id: receipt.id, number: receipt.number })
  })
  app.get('/api/trips/:id/receipts/:receiptId', async (req,res) => {
    await tripAccess(req.params.id, req.user)
    const receipt = await db.findOne('receipts', { id: req.params.receiptId, trip_id: req.params.id })
    if (!receipt) fail(404, 'Receipt not found.')
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
    res.type('html').send(renderReceipt(receipt.data))
  })
  tripRoute('post', '/api/trips/:id/settlements', async (req,res) => {
    const trip = await tripAccess(req.params.id,req.user), from = realId(req.body.from,req.user), to = realId(req.body.to,req.user), amount = cents(req.body.amount)
    if (from === to || !trip.members.some(m => m.id === from) || !trip.members.some(m => m.id === to)) fail(400,'Select two different trip members.')
    if (!mayAct(trip,from,req.user)) fail(403,'Only the sender can record this payment.')
    const current = await balances(trip,true)
    if (amount > Math.min(-current[from],current[to])) fail(409,'This payment exceeds the outstanding balance. Refresh the trip.')
    const payment = { id: randomUUID(), tripId: trip.id, from, to, amount, status: 'awaiting', createdAt: new Date().toISOString() }
    await db.insert('settlements', { id: payment.id, trip_id: trip.id, data: payment })
    res.status(201).json({ id: payment.id })
  })
  tripRoute('post', '/api/trips/:id/settlements/:paymentId/:action', async (req,res) => {
    const trip = await tripAccess(req.params.id,req.user)
    const row = await db.findOne('settlements', { id: req.params.paymentId, trip_id: trip.id })
    if (!row) fail(404,'Payment not found.')
    const payment = row.data, action = req.params.action
    if (!['confirm','cancel'].includes(action)) fail(404,'Action not found.')
    if (!mayAct(trip,payment.to,req.user) && (action === 'confirm' || !mayAct(trip,payment.from,req.user))) fail(403,'Only the recipient can confirm; sender or recipient can cancel.')
    if (payment.status !== 'awaiting') fail(409,'This payment has already been processed.')
    payment.status = action === 'confirm' ? 'confirmed' : 'cancelled'
    payment[`${action === 'confirm' ? 'confirmed' : 'cancelled'}At`] = new Date().toISOString()
    await db.update('settlements', { id: payment.id }, { $set: { data: payment } })
    res.json({ ok: true })
  })
  app.use('/api', async (req,res) => res.status(404).json({ error: 'Endpoint not found.' }))
  app.use(express.static(resolve(__dirname,'../../client/dist')))
  app.get('/{*path}', (req,res,next) => res.sendFile(resolve(__dirname,'../../client/dist/index.html'), error => error && next(error)))
  app.use((error,req,res,next) => { if (error.code === 11000) { error.status = 409; error.message = 'This record already exists. Refresh and try again.' } if (!error.status || error.status >= 500) console.error(error.message); res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : 'Something went wrong. Please try again.' }) })
  return { app, db }
}
module.exports = { createApp }
