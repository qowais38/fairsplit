const { spawn } = require('node:child_process')
const { resolve } = require('node:path')
const root=resolve(__dirname,'..')
const children=[
  spawn(process.execPath,['--watch','server.js'],{cwd:resolve(root,'server'),stdio:'inherit'}),
  spawn(process.execPath,[resolve(root,'client/node_modules/vite/bin/vite.js')],{cwd:resolve(root,'client'),stdio:'inherit'})
]
let stopping=false
function stop(code=0){if(stopping)return;stopping=true;children.forEach(child=>child.kill());process.exitCode=code}
for(const child of children){child.on('error',error=>{console.error(error.message);stop(1)});child.on('exit',code=>stop(code||0))}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
