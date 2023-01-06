import { describe, it } from 'mocha'
import * as assert from 'assert'
import * as fc from 'fast-check'
import { sort, merge, compareOn, chunkBySize, defaultStore } from '../sorting.js'
import { isDeepStrictEqual } from 'util'
import { toArray } from './utils.js'

const id = x => x

const comparer = compareOn(id)

const spyStore = () => {
  const chunks = []
  return {
    chunks: chunks,
    write: async chunk => {
      const array = await toArray(chunk)
      chunks.push(array)
      return array
    },
    dispose: async () => {}
  }
}

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

const sortPropertyWithSize = async (x, maxSize, maxFiles) => {
  const expected = x.sort()
  const actual = sort(x, { maxSize, maxFiles, comparer, store: defaultStore })

  assert.deepEqual(await toArray(actual), expected)
}

describe('chunkBySize properties', async function () {
  it('chunks can be flattened', async function () {
    await fc.assert(fc.asyncProperty(fc.nat(), fc.array(fc.string()), chunksCanBeFlattened))
  })
  it('chunks are bounded', async function () {
    await fc.assert(fc.asyncProperty(fc.nat(), fc.array(fc.string()), chunksAreBounded))
  })
  it('single chunk if size zero', async function () {
    await fc.assert(fc.asyncProperty(fc.array(fc.string()), singleChunkForSizeZero))
  })
})

describe('merge properties', async function () {
  it('preserves order with two arrays', async function () {
    const intArray = fc.array(fc.integer())
    await fc.assert(fc.asyncProperty(intArray, intArray, mergePreservesOrderForTwoArrays))
  })
  it('preserves order with multiple arrays', async function () {
    const arrays = fc.array(fc.array(fc.integer()))
    await fc.assert(fc.asyncProperty(arrays, mergePreservesOrder))
  })
})

describe('sort properties', async function () {
  it('items are sorted', async function () {
    await fc.assert(fc.asyncProperty(fc.array(fc.string()), sortProperty))
  })
  it('sorts using maxSize and maxFiles', async function () {
    const items = fc.array(fc.string())
    const maxSize = fc.nat()
    const maxFiles = fc.nat()
    await fc.assert(fc.asyncProperty(items, maxSize, maxFiles, sortPropertyWithSize))
  })
})

describe('sort examples', async function () {
  it('single chunk', async function () {
    const actual = sort([3,1,2])
    assert.deepEqual(await toArray(actual), [1,2,3])
  })
  it('two chunks', async function () {
    const actual = sort([3,1,2], { maxSize:2, comparer, store: defaultStore })
    assert.deepEqual(await toArray(actual), [1,2,3])
  })
  it('custom comparer', async function () {
    const actual = sort(['short', 'very long', 'medium'], { maxSize:2, comparer: compareOn(x => x.length), store: defaultStore })
    assert.deepEqual(await toArray(actual), ['short', 'medium', 'very long'])
  })
})

describe('sort storage', async function () {
  it('storage not used if maxSize is not reached', async function () {
    const store = spyStore()
    const sorted = sort([3,1,2], {maxSize: 4, comparer, store})
    await toArray(sorted)
    assert.equal(store.chunks.length, 0)
  })
  it('storage used', async function () {
    const store = spyStore()
    const sorted = sort([3,1,2], {maxSize: 3, comparer, store})
    await toArray(sorted)
    assert.equal(store.chunks.length, 1)
    assert.deepEqual(store.chunks, [[1,2,3]])
  })
  it('last chunk is not stored if not full', async function () {
    const store = spyStore()
    const sorted = sort([3,1,2], {maxSize: 2, comparer, store})
    await toArray(sorted)
    assert.equal(store.chunks.length, 1)
    assert.deepEqual(store.chunks, [[1,3]])
  })
  it('aggregates chunks if too many', async function () {
    const store = spyStore()
    const input = [7,4,1,9,8,3,2,6,5]
  
    const sorted = sort(input, {maxSize: 2, maxFiles: 3, comparer, store})
    await toArray(sorted)

    assert.equal(store.chunks.length, 6)
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [4,7])))
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [1,9])))
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [3,8])))
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [2,6])))
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [1,3,4,7,8,9])))
    assert.ok(store.chunks.find(x => isDeepStrictEqual(x, [2,5,6])))
  })
})