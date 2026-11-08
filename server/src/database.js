const { MongoClient } = require('mongodb')
const { AsyncLocalStorage } = require('node:async_hooks')
async function openDatabase(options = {}) {
  const client = new MongoClient(options.uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0', { serverSelectionTimeoutMS: 10000 })
  try {
    await client.connect()
    const database = client.db(options.name || process.env.MONGODB_DB || 'fairsplit')
    const hello = await database.admin().command({ hello: 1 })
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must be a replica set or Atlas cluster to support FairSplit transactions.')
    const indexes = {
      users: [[{ id: 1 }, { unique: true }], [{ email: 1 }, { unique: true }]],
      sessions: [[{ token: 1 }, { unique: true }], [{ user_id: 1 }, {}]],
      resets: [[{ token: 1 }, { unique: true }], [{ user_id: 1 }, {}]],
      trips: [[{ id: 1 }, { unique: true }]],
      members: [[{ trip_id: 1, id: 1 }, { unique: true }], [{ trip_id: 1, user_id: 1 }, { unique: true, partialFilterExpression: { user_id: { $type: 'string' } } }], [{ user_id: 1 }, {}]],
      expenses: [[{ id: 1 }, { unique: true }], [{ trip_id: 1 }, {}]],
      settlements: [[{ id: 1 }, { unique: true }], [{ trip_id: 1 }, {}]],
      invites: [[{ token: 1 }, { unique: true }], [{ trip_id: 1 }, { unique: true }]],
      receipts: [[{ id: 1 }, { unique: true }], [{ trip_id: 1, generatedAt: -1 }, {}]]
    }
    for (const [name, definitions] of Object.entries(indexes)) for (const [keys, config] of definitions) await database.collection(name).createIndex(keys, config)
    const context = new AsyncLocalStorage()
    const settings = () => ({ session: context.getStore() })
    return {
      collection: name => database.collection(name),
      findOne: (name, filter) => database.collection(name).findOne(filter, settings()),
      find: (name, filter, options = {}) => database.collection(name).find(filter, { ...options, ...settings() }).toArray(),
      insert: (name, document) => database.collection(name).insertOne(document, settings()),
      remove: (name, filter) => database.collection(name).deleteMany(filter, settings()),
      update: (name, filter, update, options = {}) => database.collection(name).updateOne(filter, update, { ...options, ...settings() }),
      transaction: async fn => {
        if (context.getStore()) return fn()
        const session = client.startSession()
        try { return await session.withTransaction(() => context.run(session, fn)) }
        finally { await session.endSession() }
      },
      close: () => client.close(),
      drop: () => database.dropDatabase()
    }
  } catch (error) { await client.close(); throw error }
}
module.exports = { openDatabase }
