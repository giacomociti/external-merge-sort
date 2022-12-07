import rdfUtils from 'rdf-utils-fs'
import { sort, compareOn } from '../../sorting.js'
import { createStore } from '../../storage.js'
import { Readable } from 'stream'
import fs from 'fs'

const log = msg => console.log(`${new Date()} ${msg}`)

async function write (chunk, filename) {
  await rdfUtils.toFile(Readable.from(chunk), filename)
  log(`created ${filename}`)
  return rdfUtils.fromFile(filename)
}

const sortRdf = async () => {
  const input = rdfUtils.fromFile('./temp/input.nt')
  const sorted = sort(input, { 
    maxSize: 1000000, 
    comparer: compareOn(x => x.subject.value), 
    store: createStore(write, '.nt')})
  await rdfUtils.toFile(Readable.from(sorted), './temp/sorted.nt')
}

log('start')
await sortRdf()
log('end')
