import { describe, it } from 'mocha'
import * as assert from 'assert'
import * as fc from 'fast-check'
import { sort, merge, compareOn, chunkBySize, defaultStore } from '../sorting.js'

const toArray = async iterable => {
  const result = []
  for await (const item of iterable) {
    result.push(item)
  }
  return result
}

const id = x => x

const comparer = compareOn(id)

const chunksCanBeFlattened = async (size, array) => {
    const chunks = await toArray(chunkBySize(size, array))

    assert.deepEqual(chunks.flatMap(id), array)
}

const chunksAreBounded = async (size, array) => {
  const chunks = await toArray(chunkBySize(size, array))

  const last = chunks.pop()
  assert.ok(chunks.every(x => x.length === size))
  if (last && size > 0) {
    assert.ok(last.length <= size)
  }
}

const singleChunkForSizeZero = async array => {
  const chunks = await toArray(chunkBySize(0, array))
  if (array.length) {
    assert.equal(chunks.length, 1)
    assert.deepEqual(chunks[0], array)
  }
  else {
    assert.equal(chunks.length, 0)
  }
}

const mergePreservesOrderForTwoArrays = async (x, y) => {
  const expected = x.concat(y).sort(comparer)
  const actual = merge([x.sort(comparer), y.sort(comparer)], comparer)

  assert.deepEqual(await toArray(actual), expected)
}

const mergePreservesOrder = async arrays => {
  const expected = arrays.flatMap(id).sort(comparer)
  arrays.forEach(x => x.sort(comparer))
  const actual = merge(arrays, comparer)

  assert.deepEqual(await toArray(actual), expected)
}

const sortProperty = async x => {
  const expected = x.sort()
  const actual = sort(x)

  assert.deepEqual(await toArray(actual), expected)
}

const sortPropertyWithSize = async (x, size) => {
  const expected = x.sort()
  const actual = sort(x, {
    maxSize: size,
    comparer: compareOn(id),
    store: defaultStore
  })

  assert.deepEqual(await toArray(actual), expected)
}

describe('chunkBySize', async function () {
  it('chunksCanBeFlattened', async function () {
    await fc.assert(fc.asyncProperty(fc.nat(), fc.array(fc.string()), chunksCanBeFlattened))
  })
  it('chunksAreBounded', async function () {
    await fc.assert(fc.asyncProperty(fc.nat(), fc.array(fc.string()), chunksAreBounded))
  })
  it('singleChunkForSizeZero', async function () {
    await fc.assert(fc.asyncProperty(fc.array(fc.string()), singleChunkForSizeZero))
  })
})

describe('merge', async function () {
  it('mergePreservesOrderForTwoArrays', async function () {
    const intArray = fc.array(fc.integer())
    await fc.assert(fc.asyncProperty(intArray, intArray, mergePreservesOrderForTwoArrays))
  })
  it('mergePreservesOrder', async function () {
    const arrays = fc.array(fc.array(fc.integer()))
    await fc.assert(fc.asyncProperty(arrays, mergePreservesOrder))
  })
})

describe('sort', async function () {
  it('single chunk', async function () {
    const actual = sort([3,1,2])
    assert.deepEqual(await toArray(actual), [1,2,3])
  })
  it('two chunks', async function () {
    const actual = sort([3,1,2], { maxSize:2, comparer: compareOn(id), store: defaultStore })
    assert.deepEqual(await toArray(actual), [1,2,3])
  })
  it('sortProperty', async function () {
    await fc.assert(fc.asyncProperty(fc.array(fc.string()), sortProperty))
  })
  it('sortPropertyWithSize', async function () {
    await fc.assert(fc.asyncProperty(fc.array(fc.string()), fc.nat(), sortPropertyWithSize))
  })
})