const { MongoMemoryReplSet } = require('mongodb-memory-server')
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')
let replica
async function startDatabase() {
  const installed = 'C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe'
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (existsSync(installed) ? installed : undefined)
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000, args: ['--wiredTigerCacheSizeGB', '0.25'] }],
    binary: { downloadDir: resolve(__dirname, '../../.mongodb-binaries'), ...(systemBinary ? { systemBinary, version: process.env.MONGOMS_VERSION || '7.0.37' } : {}) }
  })
  return replica.getUri()
}
async function stopDatabase() { if (replica) await replica.stop() }
module.exports = { startDatabase, stopDatabase }
