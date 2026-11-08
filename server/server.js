require('dotenv').config({ path: require('node:path').join(__dirname, '.env') })
const { createApp } = require('./src/app')
async function main() {
  const { app, db } = await createApp()
  const server = app.listen(process.env.PORT || 5000, () => console.log(`FairSplit running on http://localhost:${process.env.PORT || 5000}`))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await db.close(); process.exit(0) }))
}
main().catch(error => { console.error('FairSplit startup failed:', error.message); process.exitCode = 1 })
