const { spawn } = require('node:child_process')
const { mkdirSync, existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { MongoClient } = require('mongodb')
const uri = 'mongodb://127.0.0.1:27018/?replicaSet=fairsplit'
async function ready() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 })
  try { await client.connect(); await client.db().command({ ping: 1 }); return true }
  catch { return false } finally { await client.close() }
}
async function main() {
  if (await ready()) { console.log('FairSplit MongoDB is already running on port 27018.'); return }
  const installed = 'C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe'
  const executable = process.env.MONGOD_BINARY || (existsSync(installed) ? installed : 'mongod')
  const directory = resolve(__dirname, '../data/mongodb')
  mkdirSync(directory, { recursive: true })
  const child = spawn(executable, ['--replSet', 'fairsplit', '--bind_ip', '127.0.0.1', '--port', '27018', '--dbpath', directory, '--logpath', resolve(directory, 'mongod.log'), '--logappend'], { detached: true, stdio: 'ignore', windowsHide: true })
  let launchError
  child.on('error', error => { launchError = error })
  child.unref()
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError
    const direct = new MongoClient('mongodb://127.0.0.1:27018/?directConnection=true', { serverSelectionTimeoutMS: 1000 })
    try {
      await direct.connect()
      try { await direct.db().admin().command({ replSetInitiate: { _id: 'fairsplit', members: [{ _id: 0, host: '127.0.0.1:27018' }] } }) }
      catch (error) { if (error.code !== 23) throw error }
      if (await ready()) { console.log('FairSplit MongoDB is ready on port 27018. Data: server/data/mongodb'); return }
    } catch (error) { if (attempt === 59) throw error }
    finally { await direct.close() }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('MongoDB did not become ready. Check server/data/mongodb/mongod.log.')
}
main().catch(error => { console.error('Local MongoDB startup failed:', error.message); process.exitCode = 1 })
