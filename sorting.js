import Heap from 'heap'

const getIterator = iterable => {
  if (iterable[Symbol.iterator]) {
    return iterable[Symbol.iterator]()
  }
  if (iterable[Symbol.asyncIterator]) {
    return iterable[Symbol.asyncIterator]()
  }
  throw new Error(`${iterable} is not iterable`)
}

export const compareOn = key => (x, y) => {
  const k1 = key(x)
  const k2 = key(y)

  if (k1 < k2) {
    return -1
  }
  if (k2 < k1) {
    return 1
  }
  return 0
}

export async function * chunkBySize (maxSize, iterable) {
  let chunk = []
  for await (const item of iterable) {
    chunk.push(item)
    if (chunk.length === maxSize) {
      yield chunk
      chunk = []
    }
  }
  if (chunk.length > 0) {
    yield chunk
  }
}

const getSortedCollection = (items, comparer) => {
  const heap = new Heap(comparer)
  items.forEach(x => heap.push(x))
  return heap
}

export async function * merge (iterables, comparer) {
  const advance = async iterator => {
    iterator.current = await iterator.next()
  }
 
  const iterators = iterables.map(getIterator)
  for (const iterator of iterators) {
    await advance(iterator)
  }
  const nonEmptyIterators = iterators.filter(x => !x.current.done)
  const iteratorComparer = (x, y) => comparer(x.current.value, y.current.value)
  const sortedIterators = getSortedCollection(nonEmptyIterators, iteratorComparer)

  while (!sortedIterators.empty()) {
    const iterator = sortedIterators.pop()
    yield iterator.current.value
    await advance(iterator)
    if (!iterator.current.done) {
      sortedIterators.push(iterator)
    }
  }
}

async function * getSortedChunks (iterable, { maxSize, comparer, store }) {
  for await (const chunk of chunkBySize(maxSize, iterable)) {
    chunk.sort(comparer)
    if (chunk.length === maxSize) {
      yield await store.write(chunk)
    }
    else { // keep the last chunk in memory
      yield chunk
    }
  }
}

// additional pass performed only in the (unlikely) case of too many temp files
async function aggregateChunks (chunks, { maxFiles, comparer, store }) {
  const aggregated = []
  for await (const chunk of chunkBySize(maxFiles, chunks)) {
    const merged = chunk.length === 1 ? chunk[0] : merge(chunk, comparer)
    if (chunk.length === maxFiles || aggregated.length > 0) {
      aggregated.push(store.write(merged))
    }
    else { // no need for additional pass
      aggregated.push(Promise.resolve(merged))
    }
  }
  return aggregated
}

// keeps chunks in memory, not useful in practice (except as a test double)
export const defaultStore = {
  write: async chunk => chunk,
  dispose: async () => {}
}

export const defaultOptions = {
  maxSize: 1000000,
  comparer: compareOn(x => x),
  store: defaultStore
}

export async function * sort (iterable, { maxSize, maxFiles, comparer, store } = defaultOptions) {
  try {
    const sortedChunks = getSortedChunks(iterable, { maxSize, comparer, store })
    const biggerChunks = aggregateChunks(sortedChunks, { maxFiles, comparer, store })
    const iterables = await Promise.all(await biggerChunks)
    const merged = iterables.length === 1 ? iterables[0] : merge(iterables, comparer)
    yield * merged
  }
  finally {
    await store.dispose()
  }
}
