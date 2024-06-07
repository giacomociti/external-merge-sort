export { sort, merge, compareOn, chunkBySize } from './sorting.js'
export { createStore } from './storage.js'

export type AnyIterable<T> = Iterable<T> | AsyncIterable<T>

export interface Store<T> {
  write: (chunk: AnyIterable<T>) => Promise<AnyIterable<T>>
  dispose: () => Promise<void>
}
