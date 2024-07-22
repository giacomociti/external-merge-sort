import Heap from 'heap'
import type { AnyIterable, Store } from './index.js'

type StatefulIterator<T> = { current: IteratorResult<T>, advance: () => Promise<void> }

const getIterator = async <T>(iterable: AnyIterable<T>): Promise<StatefulIterator<T>> => {
  if (Symbol.iterator in iterable) {
    const iterator = iterable[Symbol.iterator]()
    const result = { current: iterator.next(), advance: async () => { result.current = iterator.next() } }
    return result
  }
  if (Symbol.asyncIterator in iterable) {
    const asyncIterator = iterable[Symbol.asyncIterator]()
    const result = { current: await asyncIterator.next(), advance: async () => { result.current = await asyncIterator.next() } }
    return result
  }
  throw new Error(`${iterable} is not iterable`)
}

interface Comparer<T> {
  (x: T, y: T): number
}

export const compareOn: <T>(key: (arg: T) => unknown) => Comparer<T> = key => (x, y) => {
  const k1: any = key(x)
  const k2: any = key(y)

  if (k1 < k2) {
    return -1
  }
  if (k2 < k1) {
    return 1
  }
  return 0
}

export async function * chunkBySize<T> (maxSize: number | undefined, iterable: AnyIterable<T>): AsyncGenerator<Array<T>> {
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

const getSortedCollection = <T>(items: T[], comparer: Comparer<T>) => {
  const heap = new Heap(comparer)
  items.forEach(x => heap.push(x))
  return heap
}

export async function * merge<T> (iterables: Array<AnyIterable<T>>, comparer: Comparer<T>) {
  const iterators = await Promise.all(iterables.map(getIterator))
  const nonEmptyIterators = iterators.filter(x => !x.current.done)
  const iteratorComparer: Comparer<StatefulIterator<T>> = (x, y) => comparer(x.current.value, y.current.value)
  const sortedIterators = getSortedCollection(nonEmptyIterators, iteratorComparer)

  while (!sortedIterators.empty()) {
    const iterator = sortedIterators.pop()!

    yield iterator.current.value
    await iterator.advance()
    if (!iterator.current.done) {
      sortedIterators.push(iterator)
    }
  }
}

async function * getSortedChunks <T> (iterable: AnyIterable<T>, { maxSize, comparer, store }: Options<T>) {
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
async function aggregateChunks <T>(chunks: AnyIterable<AnyIterable<T>>, { maxFiles, comparer, store }: Omit<Options<T>, 'maxSize'>) {
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
export const defaultStore = <T>() => ({
  write: async (chunk: AnyIterable<T>) => chunk,
  dispose: async () => {}
})

interface Options<T = unknown> {
  maxSize: number
  maxFiles?: number
  comparer: Comparer<T>
  store: Store<T>
}

export const defaultOptions = <T>() => ({
  maxSize: 1000000,
  comparer: compareOn(x => x),
  store: defaultStore<T>(),
  maxFiles: undefined
})

export async function * sort<T> (iterable: Iterable<T>, options?: Options<T>) {
  const { maxSize, maxFiles, comparer, store } = options?? defaultOptions<T>()
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
