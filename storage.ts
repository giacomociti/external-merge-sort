import os from 'os'
import fs from 'fs'
import path from 'path'
import type { AnyIterable } from './index.js'

const createTempDir = () => {
  const base = `${path.join(os.tmpdir(), 'external-merge-sort')}${path.sep}`
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base)
  }
  return fs.mkdtempSync(base)
}

export type Write<T> = (chunk: AnyIterable<T>, filename: string) => Promise<AnyIterable<T>>

export const createStore = <T>(write: Write<T>, extension = '') => {
  let temp: string | undefined
  let i = 0
  return {
    write: (chunk: AnyIterable<T>) => {
      if (!temp) {
        temp = createTempDir()
      }
      const filename = path.join(temp, `temp${++i}${extension}`)
      return write(chunk, filename)
    },
    dispose: async () => {
      if (temp) {
        try {
          fs.rmSync(temp, { recursive: true, force: true })
        }
        catch {
          // softfail if rmdir fails
        }
      }
    }
  }
}
