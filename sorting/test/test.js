import { describe, it } from 'mocha'
import * as assert from 'assert'
import * as fc from 'fast-check'
import { sort, compareOn, chunkBySize } from '../sorting.js'

const toArray = async (generator) => {
  const result = []
  for await (const item of generator) {
    result.push(item)
  }
  return result
}

const comparer = compareOn(x => x)

const chunkByProperty = async (size, array) => {
    const chunks = await toArray(chunkBySize(size, array))

    assert.deepEqual(chunks.flatMap(x => x), array)
}

const mergeProperty = async (x, y) => {
    const expected = x.concat(y).sort(comparer)
    const actual = merge(x.sort(), y.sort(), comparer)
  
    assert.deepEqual(await toArray(actual), expected)
  }

const sortProperty = async (x) => {
  const expected = x.sort()
  const actual = sort(x)

  assert.deepEqual(await toArray(actual), expected)
}

describe('random', function () {
  it('chunk', async function () {
    fc.assert(fc.asyncProperty(fc.nat(), fc.array(fc.string()), chunkByProperty))
  })
  it('sort', async function () {
    fc.assert(fc.asyncProperty(fc.array(fc.string()), sortProperty))
  })
  it('merge', async function () {
    fc.assert(fc.asyncProperty(fc.array(fc.string()), fc.array(fc.string()), mergeProperty))
  })
})

describe('sort', function () {
    it('numbers', async function () {
      const actual = sort([3,1,2])

      assert.deepEqual(await toArray(actual), [1,2,3])
    })
   
  })