import { sort, compareOn } from '../sorting.js'
import { createStore } from '../storage.js'
import stream from 'stream'
import fs from 'fs'
import { promisify } from 'util'
import JsonlParser from 'stream-json/jsonl/Parser.js'
import Stringer from 'stream-json/jsonl/Stringer.js'

const log = msg => console.log(`${new Date()} ${msg}`)

async function * readJson (filename) {
  for await (const object of fs.createReadStream(filename).pipe(new JsonlParser())) {
    yield object.value
  }
}

const writeJson = async (objects, filename) => {
  const writeStream = fs.createWriteStream(filename)
  stream.Readable.from(objects).pipe(new Stringer()).pipe(writeStream)
  await promisify(stream.finished)(writeStream)
}

async function write (chunk, filename) {
  await writeJson(chunk, filename)
  log(`created ${filename}`)
  return readJson(filename)
}

const sortJson = async () => {
  const input = readJson('./temp/input.jsonl')
  const sorted = sort(input, { 
    maxSize: 20000,
    maxFiles: 1000,
    comparer: compareOn(x => x.name), 
    store: createStore(write)})
  await writeJson(sorted, './temp/sorted.jsonl')
}

log('start')
await sortJson()
log('end')