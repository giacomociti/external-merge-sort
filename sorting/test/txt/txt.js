import readline from 'readline'
import { sort, compareOn } from '../../sorting.js'
import { createStore } from '../../storage.js'
import { finished } from 'stream'
import fs from 'fs'
import { promisify } from 'util'

const log = msg => console.log(`${new Date()} ${msg}`)

async function writeLines(lines, filename) {
  const writeStream = fs.createWriteStream(filename)
  for await (const line of lines) {
    writeStream.write(line + '\n')
  }
  writeStream.end()
  await promisify(finished)(writeStream)
}

async function * readLines (filename) {
  yield * readline.createInterface(fs.createReadStream(filename))
}

async function write (chunk, filename) {
  await writeLines(chunk, filename)
  log(`created ${filename}`)
  return readLines(filename)
}

const sortTxt = async () => {
  const input = readLines('./temp/input.txt')
  const sorted = sort(input, { 
    maxSize: 1000000,
    maxFiles: 1000,
    comparer: compareOn(x => x), 
    store: createStore(write, '.txt')})
  await writeLines(sorted, './temp/sorted.txt')
}

log('start')
await sortTxt()
log('end')
