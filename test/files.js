import { describe, it } from 'mocha'
import * as assert from 'assert'
import { Readable } from 'stream'
import rdfUtils from 'rdf-utils-fs'
import { toArray } from './utils.js'
import { sort, compareOn } from '../sorting.js'
import { createStore } from '../storage.js'

const write = async (chunk, filename) => {
  await rdfUtils.toFile(Readable.from(chunk), filename)
  return rdfUtils.fromFile(filename)
}

const store = createStore(write, '.nt')
const comparer = compareOn(x => x.subject.value)

const sortFile = async inputFile => {
  const input = rdfUtils.fromFile(inputFile)
  const sorted = sort(input, { maxSize: 2, comparer, store })
  return await toArray(sorted)
}

describe('files', async function () {
  it('sorts rdf file', async function () {
    const result = await sortFile('./test/support/input.nt')
    const actual = result.map(x => x.subject)
    const expected = result.sort(comparer).map(x => x.subject)
    assert.deepEqual(actual, expected)
  })
})