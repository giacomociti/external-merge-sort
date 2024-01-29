import os from 'os'
import fs from 'fs'
import path from 'path'

const createTempDir = () => {
  const base = `${path.join(os.tmpdir(), 'external-merge-sort')}${path.sep}`
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base)
  }
  return fs.mkdtempSync(base)
}

export const createStore = (write, extension = '') => {
  let temp
  let i = 0
  return {
    write: chunk => {
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
