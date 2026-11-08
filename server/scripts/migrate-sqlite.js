require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') })
const { DatabaseSync } = require('node:sqlite')
const { resolve } = require('node:path')
const { openDatabase } = require('../src/database')
async function main() {
  const source = new DatabaseSync(resolve(process.argv[2] || resolve(__dirname, '../data/fairsplit.sqlite')), { readOnly: true })
  let target
  try {
    target = await openDatabase()
    const names = ['users', 'sessions', 'resets', 'trips', 'members', 'expenses', 'settlements', 'invites']
    source.exec('BEGIN')
    const rows = Object.fromEntries(names.map(name => [name, source.prepare(`SELECT * FROM ${name}`).all().map(row => ({ ...row, ...(row.data ? { data: JSON.parse(row.data) } : {}) }))]))
    source.exec('COMMIT')
    await target.transaction(async () => {
      for (const name of names) if (await target.findOne(name, {})) throw new Error(`Target collection ${name} is not empty. Choose an empty MONGODB_DB; no records were imported.`)
      for (const name of names) for (const row of rows[name]) await target.insert(name, row)
    })
    console.log('SQLite data imported into MongoDB:', Object.fromEntries(names.map(name => [name, rows[name].length])))
    console.log('Original SQLite file was left unchanged.')
  } finally { source.close(); if (target) await target.close() }
}
main().catch(error => { console.error('Migration failed:', error.message); process.exitCode = 1 })
