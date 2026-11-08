const { test, before, after } = require('node:test')
const { randomUUID } = require('node:crypto')
const { startDatabase, stopDatabase } = require('./mongo')
let uri
before(async () => { uri = await startDatabase() }, { timeout: 180000 })
after(stopDatabase)
const assert = require('node:assert/strict')
const { once } = require('node:events')
const { createApp } = require('../src/app')

async function setup(t, options = {}) {
  const context = await createApp({ database: { uri, name: `test_${randomUUID().replaceAll('-', '')}` }, authLimit: 1000, ...options })
  const server = context.app.listen(0,'127.0.0.1')
  await once(server,'listening')
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await context.db.drop();await context.db.close()})
  const base=`http://127.0.0.1:${server.address().port}/api`
  const client=()=>{
    let cookie=''
    return async (path, method='GET', body, status=200, headers={})=>{
      const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie,...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})})
      const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0]
      const data=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()
      assert.equal(response.status,status,JSON.stringify(data))
      return data
    }
  }
  return {...context,client,base}
}
const signup=(request,email='owner@example.com',name='Owner')=>request('/auth/signup','POST',{email,name,password:'test-password-123'},201)
const tripInput={name:'Weekend',location:'California',guestNames:[],startDate:'2026-11-07',endDate:'2026-11-09'}
const expenseInput={title:'Dinner',amount:10001,payer:'you',category:'Food',date:'2026-11-07',splitType:'equal',people:['you']}

test('accounts validate credentials, isolate sessions, reject foreign origins and revoke logout',async t=>{
  const {client,db}=await setup(t), a=client(), anonymous=client()
  await anonymous('/state','GET',undefined,401)
  await anonymous('/auth/signup','POST',[],400)
  await a('/auth/signup','POST',{email:'bad',name:'Owner',password:'123'},400)
  const {user}=await signup(a)
  assert.equal((await a('/auth/me')).user.id,user.id)
  await anonymous('/auth/login','POST',{email:user.email,password:'wrong-password'},401)
  await anonymous('/auth/signup','POST',{email:user.email,name:'Other',password:'test-password-123'},409)
  const stored=await db.collection('users').findOne({})
  assert.notEqual(stored.password,'test-password-123')
  await a('/trips','POST',tripInput,403,{Origin:'https://attacker.example'})
  await a('/auth/logout','POST',{})
  await a('/auth/me','GET',undefined,401)
  await a('/auth/login','POST',{email:user.email.toUpperCase(),password:'test-password-123'})
  assert.equal((await a('/state')).trips.length,0)
})

test('invitations authorize access, rotate, expire and join without duplicate memberships',async t=>{
  const {client,db}=await setup(t), owner=client(), friend=client(), outsider=client()
  await signup(owner);await signup(friend,'friend@example.com','Friend');await signup(outsider,'outsider@example.com')
  const trip=await owner('/trips','POST',tripInput,201)
  await friend(`/trips/${trip.id}/expenses`,'POST',expenseInput,404)
  assert.equal((await friend('/state')).trips.length,0)
  const first=await owner(`/trips/${trip.id}/invites`,'POST',{},201)
  const second=await owner(`/trips/${trip.id}/invites`,'POST',{},201)
  const invite=url=>new URL(url).searchParams.get('invite')
  await friend('/invites/join','POST',{token:invite(first.url)},404)
  await friend('/invites/join','POST',{token:invite(second.url)})
  await friend('/invites/join','POST',{token:invite(second.url)})
  assert.equal((await friend('/state')).trips[0].members.length,2)
  await friend(`/trips/${trip.id}/invites`,'POST',{},403)
  await db.collection('invites').updateMany({}, { $set: { expires: 0 } })
  await outsider('/invites/join','POST',{token:invite(second.url)},404)
})

test('expenses enforce cent precision, splits, membership, dates and concurrent edit versions',async t=>{
  const {client}=await setup(t), owner=client(), outsider=client()
  await signup(owner);await signup(outsider,'outsider@example.com')
  const trip=await owner('/trips','POST',{...tripInput,guestNames:['Guest A','Guest B']},201)
  const members=(await owner('/state')).trips[0].members
  const base=`/trips/${trip.id}/expenses`
  for(const patch of [{amount:1.5},{amount:0},{payer:'outsider'},{contributions:{you:10000}},{contributions:{you:-1}},{contributions:{outsider:10001}},{date:'2026-02-30'},{category:'invalid'}]) await owner(base,'POST',{...expenseInput,...patch},400)
  const expense=await owner(base,'POST',{...expenseInput,people:members,shares:{you:0}},201)
  let state=await owner('/state'), saved=state.expenses[0]
  assert.equal(Object.values(saved.shares).reduce((a,b)=>a+b,0),10001)
  assert.deepEqual(Object.values(saved.shares).sort(),[3333,3334,3334])
  await outsider(`${base}/${expense.id}`,'PUT',saved,404)
  await outsider(`${base}/${expense.id}`,'DELETE',undefined,404)
  await owner(`${base}/${expense.id}`,'PUT',{...saved,title:'Updated dinner'})
  await owner(`${base}/${expense.id}`,'PUT',saved,409)
  state=await owner('/state');assert.equal(state.expenses[0].title,'Updated dinner')
  await owner(`${base}/${expense.id}`,'DELETE')
  assert.equal((await owner('/state')).expenses.length,0)
})

test('repayments reserve pending balances, enforce sender/recipient roles and confirm once',async t=>{
  const {client}=await setup(t), owner=client(), friend=client()
  const {user:ownerUser}=await signup(owner),{user:friendUser}=await signup(friend,'friend@example.com','Friend')
  const trip=await owner('/trips','POST',tripInput,201)
  const invitation=await owner(`/trips/${trip.id}/invites`,'POST',{},201)
  await friend('/invites/join','POST',{token:new URL(invitation.url).searchParams.get('invite')})
  await owner(`/trips/${trip.id}/expenses`,'POST',{...expenseInput,amount:10000,people:['you',friendUser.id]},201)
  const base=`/trips/${trip.id}/settlements`
  await owner(base,'POST',{from:friendUser.id,to:'you',amount:1000},403)
  await friend(base,'POST',{from:'you',to:ownerUser.id,amount:5001},409)
  const payment=await friend(base,'POST',{from:'you',to:ownerUser.id,amount:3000},201)
  await friend(base,'POST',{from:'you',to:ownerUser.id,amount:2001},409)
  await friend(`${base}/${payment.id}/confirm`,'POST',{},403)
  await owner(`${base}/${payment.id}/confirm`,'POST',{})
  await owner(`${base}/${payment.id}/confirm`,'POST',{},409)
  const remainder=await friend(base,'POST',{from:'you',to:ownerUser.id,amount:2000},201)
  await friend(`${base}/${remainder.id}/cancel`,'POST',{})
  const final=await friend(base,'POST',{from:'you',to:ownerUser.id,amount:2000},201)
  await owner(`${base}/${final.id}/confirm`,'POST',{})
  await friend(base,'POST',{from:'you',to:ownerUser.id,amount:1},409)
  const state=await owner('/state')
  assert.deepEqual(state.settlements.map(s=>s.status),['confirmed','cancelled','confirmed'])
  assert.equal(state.settlements.filter(s=>s.status==='confirmed').reduce((sum,s)=>sum+s.amount,0),5000)
})

test('password resets are single-use, expire, and revoke existing sessions',async t=>{
  let resetUrl
  const {client,db}=await setup(t,{sendReset:async(email,url)=>{resetUrl=url}}), owner=client(), anonymous=client()
  await signup(owner)
  await anonymous('/auth/forgot','POST',{email:'missing@example.com'})
  assert.equal(resetUrl,undefined)
  await anonymous('/auth/forgot','POST',{email:'owner@example.com'})
  const value=new URL(resetUrl).searchParams.get('reset')
  assert.notEqual((await db.collection('resets').findOne({})).token,value)
  await anonymous('/auth/reset','POST',{token:'invalid',password:'updated-password'},400)
  await anonymous('/auth/reset','POST',{token:value,password:'updated-password'})
  await owner('/state','GET',undefined,401)
  await anonymous('/auth/reset','POST',{token:value,password:'another-password'},400)
  await anonymous('/auth/login','POST',{email:'owner@example.com',password:'test-password-123'},401)
  await anonymous('/auth/login','POST',{email:'owner@example.com',password:'updated-password'})
  await anonymous('/auth/forgot','POST',{email:'owner@example.com'})
  await db.collection('resets').updateMany({}, { $set: { expires: 0 } })
  await anonymous('/auth/reset','POST',{token:new URL(resetUrl).searchParams.get('reset'),password:'another-password'},400)
})

test('data and sessions survive reopening the database',async t=>{
  const database = { uri, name: `persist_${randomUUID().replaceAll('-', '')}` }
  const first=await createApp({database}), server=first.app.listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}/api`
  const response=await fetch(base+'/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Persistent',email:'persist@example.com',password:'test-password-123'})})
  const cookie=response.headers.get('set-cookie').split(';')[0]
  await fetch(base+'/trips',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(tripInput)})
  await new Promise(resolve=>server.close(resolve));await first.db.close()
  const next=await createApp({database}), restarted=next.app.listen(0,'127.0.0.1');await once(restarted,'listening')
  try {const state=await fetch(`http://127.0.0.1:${restarted.address().port}/api/state`,{headers:{cookie}});assert.equal(state.status,200);assert.equal((await state.json()).trips[0].name,'Weekend')}
  finally {await new Promise(resolve=>restarted.close(resolve));await next.db.drop();await next.db.close()}
})

test('authentication throttles repeated attempts',async t=>{
  const {client}=await setup(t,{authLimit:2}), request=client()
  await request('/auth/login','POST',{email:'missing@example.com',password:'invalid-password'},401)
  await request('/auth/login','POST',{email:'missing@example.com',password:'invalid-password'},401)
  await request('/auth/login','POST',{email:'missing@example.com',password:'invalid-password'},429)
})

test('concurrent writes reject stale edits and cannot over-reserve repayments', async t => {
  const { client } = await setup(t), owner = client(), friend = client()
  await signup(owner)
  const {user} = await signup(friend, 'friend@example.com', 'Friend')
  const trip = await owner('/trips', 'POST', { ...tripInput, memberIds: [user.id] }, 201)
  const members = (await owner('/state')).trips[0].members
  const base = `/trips/${trip.id}`
  const expense = await owner(`${base}/expenses`, 'POST', { ...expenseInput, amount: 10000, people: members }, 201)
  const saved = (await owner('/state')).expenses[0]
  const edits = await Promise.allSettled([
    owner(`${base}/expenses/${expense.id}`, 'PUT', { ...saved, title: 'First' }),
    owner(`${base}/expenses/${expense.id}`, 'PUT', { ...saved, title: 'Second' })
  ])
  assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(edits.find(result => result.status === 'rejected').reason.message, /changed/)
  const ownerId = (await owner('/auth/me')).user.id
  const payments = await Promise.allSettled([
    friend(`${base}/settlements`, 'POST', { from: 'you', to: ownerId, amount: 4000 }, 201),
    friend(`${base}/settlements`, 'POST', { from: 'you', to: ownerId, amount: 4000 }, 201)
  ])
  assert.equal(payments.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(payments.find(result => result.status === 'rejected').reason.message, /outstanding balance/)
  assert.equal((await owner('/state')).settlements.length, 1)
})

test('registered accounts can be selected at creation and added later only by the manager', async t => {
  const {client}=await setup(t), manager=client(), member=client(), other=client(), anonymous=client()
  const {user:owner}=await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  const {user:third}=await signup(other,'third@example.com','Third')
  await anonymous('/users/lookup?email=friend@example.com','GET',undefined,401)
  const lookup=await manager('/users/lookup?email=FRIEND@example.com')
  assert.deepEqual(lookup.user,friend)
  assert.equal(Object.hasOwn(lookup.user,'password'),false)
  await manager('/users/lookup?email=missing@example.com','GET',undefined,404)
  await manager('/trips','POST',{...tripInput,memberIds:['missing']},400)
  await manager('/trips','POST',{...tripInput,memberIds:[friend.id,friend.id]},400)
  assert.equal((await manager('/state')).trips.length,0)
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id,owner.id]},201)
  const state=await member('/state')
  assert.equal(state.trips[0].isOwner,false)
  assert.equal(state.trips[0].managerName,'Owner')
  assert.equal(state.trips[0].members.length,2)
  const base=`/trips/${trip.id}/members`
  await member(base,'POST',{memberIds:[third.id]},403)
  await other(base,'POST',{memberIds:[third.id]},404)
  await manager(base,'POST',{memberIds:[third.id]})
  await manager(base,'POST',{memberIds:[third.id]})
  assert.equal((await other('/state')).trips[0].members.length,3)
})

test('member expenses require manager approval, support multiple payers, and preserve permissions', async t => {
  const {client}=await setup(t), manager=client(), member=client(), third=client()
  const {user:owner}=await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  const {user:other}=await signup(third,'third@example.com','Other')
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id,other.id]},201)
  const base=`/trips/${trip.id}/expenses`
  await member(base,'POST',{...expenseInput,payer:owner.id},403)
  const saved=await member(base,'POST',{...expenseInput,amount:10000,contributions:{you:6000,[owner.id]:4000},status:'approved',submittedBy:owner.id,people:['you'],shares:{you:1},splitType:'custom'},201)
  assert.equal(saved.status,'pending')
  let state=await manager('/state'), expense=state.expenses[0]
  assert.equal(expense.status,'pending')
  assert.equal(expense.canReview,true)
  assert.equal(expense.submittedBy,friend.id)
  assert.equal(expense.people.length,3)
  assert.deepEqual(Object.values(expense.shares).sort(),[3333,3333,3334])
  assert.equal((await third('/state')).expenses.length,0)
  await member(`/trips/${trip.id}/settlements`,'POST',{from:'you',to:owner.id,amount:1},409)
  await member(`${base}/${saved.id}/review`,'POST',{decision:'approve',version:1},403)
  await third(`${base}/${saved.id}`,'PUT',{...expenseInput,version:1},403)
  await third(`${base}/${saved.id}`,'DELETE',undefined,403)
  await manager(`${base}/${saved.id}/review`,'POST',{decision:'approve',version:99},409)
  await manager(`${base}/${saved.id}/review`,'POST',{decision:'approve',version:1})
  await manager(`${base}/${saved.id}/review`,'POST',{decision:'approve',version:1},409)
  expense=(await member('/state')).expenses[0]
  assert.equal(expense.status,'approved')
  assert.equal(expense.canEdit,false)
  assert.equal(expense.contributions.you,6000)
  assert.equal((await third('/state')).expenses.length,1)
  await member(`${base}/${saved.id}`,'PUT',{...expenseInput,version:2},403)
  await member(`${base}/${saved.id}`,'DELETE',undefined,403)
  const payment=await third(`/trips/${trip.id}/settlements`,'POST',{from:'you',to:owner.id,amount:666},201)
  const managerPayment=(await manager('/state')).settlements[0]
  assert.equal(managerPayment.canConfirm,true)
  assert.equal((await third('/state')).settlements[0].canConfirm,false)
  assert.equal((await member('/state')).settlements[0].canConfirm,false)
  await member(`/trips/${trip.id}/settlements/${payment.id}/confirm`,'POST',{},403)
  await third(`/trips/${trip.id}/settlements/${payment.id}/confirm`,'POST',{},403)
  await manager(`/trips/${trip.id}/settlements/${payment.id}/confirm`,'POST',{})
  const rejected=await member(base,'POST',{...expenseInput,amount:3000},201)
  await manager(`${base}/${rejected.id}/review`,'POST',{decision:'reject',version:1})
  let mine=(await member('/state')).expenses.find(e=>e.id===rejected.id)
  assert.equal(mine.status,'rejected')
  assert.equal(mine.canEdit,true)
  await member(`${base}/${rejected.id}`,'PUT',{...mine,title:'Corrected receipt'})
  mine=(await manager('/state')).expenses.find(e=>e.id===rejected.id)
  assert.equal(mine.status,'pending')
  assert.equal(mine.version,3)
  assert.equal(mine.reviewedAt,undefined)
  await manager(`${base}/${rejected.id}/review`,'POST',{decision:'approve',version:2},409)
  await manager(`${base}/${rejected.id}/review`,'POST',{decision:'approve',version:3})
})

test('manager cannot confirm another recipient payment, including legacy offline guests', async t => {
  const {client}=await setup(t), manager=client(), member=client(), third=client()
  const {user:owner}=await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  const {user:other}=await signup(third,'third@example.com','Third')
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id,other.id],guestNames:['Legacy guest']},201)
  const base=`/trips/${trip.id}`
  await manager(`${base}/expenses`,'POST',{...expenseInput,amount:12000,payer:friend.id},201)
  const payment=await third(`${base}/settlements`,'POST',{from:'you',to:friend.id,amount:3000},201)
  assert.equal((await manager('/state')).settlements[0].canConfirm,false)
  await manager(`${base}/settlements/${payment.id}/confirm`,'POST',{},403)
  await member(`${base}/settlements/${payment.id}/confirm`,'POST',{})
  const guest=(await manager('/state')).trips[0].memberDetails.find(m=>!m.hasAccount).id
  await manager(`${base}/settlements`,'POST',{from:guest,to:friend.id,amount:3000},403)
  assert.deepEqual((await manager('/state')).trips[0].recordableMembers,['you'])
})

test('approval divides among current members and concurrent reviews apply once', async t => {
  const {client}=await setup(t), manager=client(), member=client(), third=client()
  await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  const {user:other}=await signup(third,'third@example.com','Third')
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id]},201)
  const base=`/trips/${trip.id}`
  const submission=await member(`${base}/expenses`,'POST',{...expenseInput,amount:3000},201)
  await manager(`${base}/members`,'POST',{memberIds:[other.id]})
  const results=await Promise.allSettled([
    manager(`${base}/expenses/${submission.id}/review`,'POST',{decision:'approve',version:1}),
    manager(`${base}/expenses/${submission.id}/review`,'POST',{decision:'reject',version:1})
  ])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  const saved=(await manager('/state')).expenses[0]
  assert.equal(saved.version,2)
  if(saved.status==='approved') assert.deepEqual(Object.values(saved.shares),[1000,1000,1000])
})

test('only the manager can delete a trip; related data is removed and accounts and other trips survive', async t => {
  const {client,db}=await setup(t), manager=client(), member=client(), outsider=client()
  await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  await signup(outsider,'outsider@example.com','Outsider')
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id]},201)
  const other=await manager('/trips','POST',{...tripInput,name:'Keep this trip',memberIds:[friend.id]},201)
  const base=`/trips/${trip.id}`
  const invite=await manager(`${base}/invites`,'POST',{},201)
  await manager(`${base}/expenses`,'POST',{...expenseInput,amount:10000},201)
  await member(`${base}/expenses`,'POST',{...expenseInput,title:'Pending receipt'},201)
  await member(`${base}/settlements`,'POST',{from:'you',to:(await manager('/auth/me')).user.id,amount:1000},201)
  await member(base,'DELETE',undefined,403)
  await outsider(base,'DELETE',undefined,404)
  assert.equal(await db.collection('expenses').countDocuments({trip_id:trip.id}),2)
  const userCount=await db.collection('users').countDocuments()
  const sessionCount=await db.collection('sessions').countDocuments()
  await manager(base,'DELETE')
  await manager(base,'DELETE',undefined,404)
  assert.equal(await db.collection('trips').countDocuments({id:trip.id}),0)
  for(const name of ['members','expenses','settlements','invites']) assert.equal(await db.collection(name).countDocuments({trip_id:trip.id}),0,name)
  assert.equal(await db.collection('users').countDocuments(),userCount)
  assert.equal(await db.collection('sessions').countDocuments(),sessionCount)
  assert.deepEqual((await member('/state')).trips.map(t=>t.id),[other.id])
  assert.deepEqual((await manager('/state')).trips.map(t=>t.id),[other.id])
  await outsider('/invites/join','POST',{token:new URL(invite.url).searchParams.get('invite')},404)
  await member(`${base}/expenses`,'POST',expenseInput,404)
  await manager(`/trips/${other.id}`,'DELETE')
  assert.equal((await manager('/state')).trips.length,0)
})

test('trip deletion rolls back all removals if any database operation fails', async t => {
  const {client,db}=await setup(t), manager=client()
  await signup(manager)
  const trip=await manager('/trips','POST',tripInput,201)
  await manager(`/trips/${trip.id}/invites`,'POST',{},201)
  await manager(`/trips/${trip.id}/expenses`,'POST',expenseInput,201)
  const remove=db.remove
  db.remove=async(name,filter)=>{if(name==='expenses')throw new Error('Injected deletion failure');return remove(name,filter)}
  try { await manager(`/trips/${trip.id}`,'DELETE',undefined,500) }
  finally { db.remove=remove }
  assert.equal(await db.collection('trips').countDocuments({id:trip.id}),1)
  for(const name of ['members','expenses','invites']) assert.equal(await db.collection(name).countDocuments({trip_id:trip.id}),1,name)
  assert.equal((await manager('/state')).trips[0].id,trip.id)
})


test('manager ends a reviewed trip, freezes expenses, and issues private immutable receipts while payments can continue', async t => {
  const {client,db,base}=await setup(t), manager=client(), member=client(), outsider=client()
  const {user:owner}=await signup(manager)
  const {user:friend}=await signup(member,'friend@example.com','Friend')
  const {user:other}=await signup(outsider,'other@example.com','Other')
  const trip=await manager('/trips','POST',{...tripInput,memberIds:[friend.id]},201)
  const path=`/trips/${trip.id}`
  const expense=await manager(`${path}/expenses`,'POST',{...expenseInput,amount:10000,title:'Dinner <script>alert(1)</script>'},201)
  const pending=await member(`${path}/expenses`,'POST',{...expenseInput,amount:1000},201)
  const invite=await manager(`${path}/invites`,'POST',{},201)
  await manager(`${path}/receipts`,'POST',{},409)
  await member(`${path}/complete`,'POST',{},403)
  await outsider(`${path}/complete`,'POST',{},404)
  await manager(`${path}/complete`,'POST',{},409)
  await manager(`${path}/expenses/${pending.id}/review`,'POST',{decision:'reject',version:1})
  const payment=await member(`${path}/settlements`,'POST',{from:'you',to:owner.id,amount:2000},201)
  await manager(`${path}/complete`,'POST',{})
  await manager(`${path}/complete`,'POST',{},409)
  let state=await manager('/state')
  assert.equal(state.trips[0].status,'completed')
  assert.ok(state.trips[0].completedAt)
  assert.equal(state.expenses.find(e=>e.id===expense.id).canEdit,false)
  assert.equal(state.expenses.find(e=>e.id===pending.id).canEdit,false)
  await manager(`${path}/expenses`,'POST',expenseInput,409)
  await member(`${path}/expenses`,'POST',expenseInput,409)
  await manager(`${path}/expenses/${expense.id}`,'PUT',{...expenseInput,version:1},409)
  await manager(`${path}/expenses/${expense.id}`,'DELETE',undefined,409)
  await manager(`${path}/expenses/${pending.id}/review`,'POST',{decision:'approve',version:2},409)
  await manager(`${path}/members`,'POST',{memberIds:[other.id]},409)
  await manager(`${path}/invites`,'POST',{},409)
  await outsider('/invites/join','POST',{token:new URL(invite.url).searchParams.get('invite')},404)
  await member(`${path}/receipts`,'POST',{},403)
  await outsider(`${path}/receipts`,'POST',{},404)
  const first=await manager(`${path}/receipts`,'POST',{},201)
  const saved=(await db.collection('receipts').findOne({id:first.id})).data
  assert.equal(saved.total,10000)
  assert.equal(saved.pendingTotal,2000)
  assert.equal(saved.confirmedTotal,0)
  assert.equal(saved.excludedCount,1)
  assert.equal(saved.settled,false)
  assert.equal(saved.members.find(m=>m.id===friend.id).balance,-5000)
  const html=await member(`${path}/receipts/${first.id}`)
  assert.match(html,/Print \/ Save as PDF/)
  assert.match(html,/Copy share link/)
  assert.match(html,/PKR/)
  assert.match(html,/Outstanding balances remain/)
  assert.match(html,/Pending confirmation/)
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(!html.includes('<script>alert(1)</script>'))
  await outsider(`${path}/receipts/${first.id}`,'GET',undefined,404)
  const anonymous=await fetch(`${base}${path}/receipts/${first.id}`,{redirect:'manual'})
  assert.equal(anonymous.status,302)
  assert.equal(new URL(anonymous.headers.get('location')).searchParams.get('receipt'),first.id)
  assert.equal(new URL(anonymous.headers.get('location')).searchParams.get('receiptTrip'),trip.id)
  await manager(`${path}/settlements/${payment.id}/confirm`,'POST',{})
  const next=await manager(`${path}/receipts`,'POST',{},201)
  const updated=(await db.collection('receipts').findOne({id:next.id})).data
  assert.notEqual(first.id,next.id)
  assert.equal(updated.pendingTotal,0)
  assert.equal(updated.confirmedTotal,2000)
  assert.equal(updated.members.find(m=>m.id===friend.id).balance,-3000)
  assert.deepEqual((await db.collection('receipts').findOne({id:first.id})).data,saved)
  state=await member('/state')
  assert.equal(state.trips[0].receipt.id,next.id)
  assert.equal(state.trips[0].receipt.number,next.number)
  const finalPayment=await member(`${path}/settlements`,'POST',{from:'you',to:owner.id,amount:3000},201)
  await manager(`${path}/settlements/${finalPayment.id}/confirm`,'POST',{})
  const settled=await manager(`${path}/receipts`,'POST',{},201)
  assert.equal((await db.collection('receipts').findOne({id:settled.id})).data.settled,true)
  await manager(path,'DELETE')
  assert.equal(await db.collection('receipts').countDocuments({trip_id:trip.id}),0)
})
