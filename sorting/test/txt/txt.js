import readline from 'readline'
import { sort, compareOn } from '../../sorting.js'
import { createStore } from '../../storage.js'
import stream from 'stream'
import fs from 'fs'
import { promisify } from 'util'

const finished = promisify(stream.finished)

const log = msg => console.log(`${new Date()} ${msg}`)

async function writeLines(lines, filename) {
  const writeStream = fs.createWriteStream(filename)
  for await (const line of lines) {
    writeStream.write(line + '\n') // todo check if result is false
  }
  writeStream.end()
  await finished(writeStream)
}

async function * read(filename) {
  yield * readline.createInterface({ input: fs.createReadStream(filename) })
}

async function write (chunk, filename) {
  await writeLines(chunk, filename)
  log(`created ${filename}`)
  return read(filename)
}

const sortTxt = async () => {
  const input = read('./temp/input.nt')
  const sorted = sort(input, { 
    maxSize: 1000000, 
    comparer: compareOn(x => x), 
    store: createStore(write, '.txt')})
  await writeLines(sorted, './temp/sorted.txt')
}

log('start')
await sortTxt()
log('end')
