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
  for (const item of items) {
    heap.push(item)
  }
  return heap
}

export async function * merge (iterables, comparer) {
  const advance = async it => {
    it.curr = await it.next()
  }
 
  const iterators = iterables.map(getIterator)
  for (const it of iterators) {
    await advance(it)
  }
  const nonEmptyIterators = iterators.filter(x => !x.curr.done)
  const iteratorComparer = (x, y) => comparer(x.curr.value, y.curr.value)
  const sortedIterators = getSortedCollection(nonEmptyIterators, iteratorComparer)

  while (!sortedIterators.empty()) {
    const it = sortedIterators.pop()
    yield it.curr.value
    await advance(it)
    if (!it.curr.done) {
      sortedIterators.push(it)
    }
  }
}

export const defaultStore = {
  write: async chunk => chunk,
  dispose: async () => {}
}

const defaultOptions = {
  maxSize: 1000000,
  comparer: compareOn(x => x),
  store: defaultStore
}

export async function * sort (iterable, { maxSize, comparer, store } = defaultOptions) {
  const chunks = []
  try {
    for await (const chunk of chunkBySize(maxSize, iterable)) {
      chunk.sort(comparer)
      if (chunk.length < maxSize) {
        chunks.push(chunk)
      }
      else {
        chunks.push(await store.write(chunk))
      }
    }
    if (chunks.length === 1) {
      yield * chunks[0]
    }
    else {
      yield * merge(chunks, comparer)
    }
  }
  finally {
    await store.dispose()
  }
}
