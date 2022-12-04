import os from 'os'
import fs from 'fs'
import path from 'path'

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

const getIterator = iterable => {
  if (iterable[Symbol.iterator]) {
    return iterable[Symbol.iterator]()
  }
  if (iterable[Symbol.asyncIterator]) {
    return iterable[Symbol.asyncIterator]()
  }
  throw new Error(`${iterable} is not iterable`)
}

async function * mergeFiles (files, comparer) {
  const advance = async it => {
    it.curr = await it.next()
  }
  // todo use a sorted collection
  const add = x => {
    if (x.curr.done) {
      return
    }
    for (const i in sortedIterators) {
      if (comparer(x.curr.value, sortedIterators[i].curr.value) < 0) {
        sortedIterators.splice(i, 0, x)
        return
      }
    }
    sortedIterators.push(x)
  }
  console.log('merging')
  const iterators = files.map(getIterator)
  for (const it of iterators) {
    await advance(it)
  }
  const sortedIterators = []
  iterators.forEach(add)

  while (sortedIterators.length > 0) {
    const it = sortedIterators.shift()
    yield it.curr.value
    await advance(it)
    add(it)
  }
}

export const createTempFolder = (extension, write) => {
  let temp
  const init = async () => {
    const base = `${path.join(os.tmpdir(), 'external-sort')}${path.sep}`
    if (!fs.existsSync(base)) {
      fs.mkdirSync(base)
    }
    temp = fs.mkdtempSync(base)
    console.log(`created ${temp}`)
  }

  let i = 0
  return {
    dispose: async () => {
      if (temp) {
        fs.rmSync(temp, { recursive: true })
        console.log(`deleted ${temp}`)
      }
    },
    write: async (chunk) => {
      if (!temp) {
        await init()
      }
      const filename = path.join(temp, `temp${++i}${extension}`)
      const iterable = await write(chunk, filename)
      console.log('created ' + filename)
      return iterable
    }
  }
}

export async function * chunkBySize (maxSize, iterator) {
  let chunk = []
  for await (const item of iterator) {
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



const defaultOptions = {
  maxSize: 1000000,
  comparer: compareOn(x => x),
  extension: '.txt',
  write: x => x
}

export async function * sort (iterator, { maxSize, comparer, extension, write } = defaultOptions) {
  const store = createTempFolder(extension, write)
  const files = []

  try {
    for await (const chunk of chunkBySize(maxSize, iterator)) {
      chunk.sort(comparer)
      if (chunk.length < maxSize) {
        files.push(chunk)
      }
      else {
        files.push(await store.write(chunk))
      }
    }
    if (files.length === 1) {
      yield * files[0]
    }
    else {
      yield * mergeFiles(files, comparer)
    }
  }
  finally {
    await store.dispose()
  }
}
