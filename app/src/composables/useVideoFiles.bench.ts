import { bench, describe } from 'vitest'

// Mocks for File System API
class MockFile {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

class MockFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string

  constructor(name: string, isFile: boolean, isDirectory: boolean) {
    this.name = name
    this.isFile = isFile
    this.isDirectory = isDirectory
  }
}

class MockFileSystemFileEntry extends MockFileSystemEntry {
  constructor(name: string) {
    super(name, true, false)
  }

  file(successCallback: (file: any) => void) {
    // Simulate async file access
    setTimeout(() => {
      successCallback(new MockFile(this.name))
    }, 1) // 1ms delay to simulate I/O
  }
}

class MockFileSystemDirectoryEntry extends MockFileSystemEntry {
  entries: MockFileSystemEntry[]

  constructor(name: string, entries: MockFileSystemEntry[] = []) {
    super(name, false, true)
    this.entries = entries
  }

  createReader() {
    return {
      readEntries: (successCallback: (entries: MockFileSystemEntry[]) => void) => {
        // Simulate async directory reading
        setTimeout(() => {
          successCallback(this.entries)
        }, 1)
      },
    }
  }
}

// Slow version (Original)
async function readAllFilesInDirectorySlow(directoryEntry: any): Promise<any[]> {
  const files: any[] = []

  const reader = directoryEntry.createReader()
  const entries = await new Promise<any[]>((resolve) => {
    reader.readEntries(resolve)
  })

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<any>((resolve, reject) => {
        (entry as any).file(resolve, reject)
      })
      files.push(file)
    }
    else if (entry.isDirectory) {
      const subFiles = await readAllFilesInDirectorySlow(entry as any)
      files.push(...subFiles)
    }
  }

  return files
}

// Fast version (Optimized)
async function readAllFilesInDirectoryFast(directoryEntry: any): Promise<any[]> {
  const reader = directoryEntry.createReader()
  const entries = await new Promise<any[]>((resolve) => {
    reader.readEntries(resolve)
  })

  const promises = entries.map(async (entry) => {
    if (entry.isFile) {
      const file = await new Promise<any>((resolve, reject) => {
        (entry as any).file(resolve, reject)
      })
      return [file]
    }
    else if (entry.isDirectory) {
      const subFiles = await readAllFilesInDirectoryFast(entry as any)
      return subFiles
    }
    return []
  })

  const results = await Promise.all(promises)
  return results.flat()
}

// Setup test data
// Create a directory structure with 100 files to simulate a real scenario
const files = Array.from({ length: 100 }, (_, i) => new MockFileSystemFileEntry(`file${i}.mp4`))
const root = new MockFileSystemDirectoryEntry('root', files)

describe('readAllFilesInDirectory', () => {
  bench('slow', async () => {
    await readAllFilesInDirectorySlow(root)
  })

  bench('fast', async () => {
    await readAllFilesInDirectoryFast(root)
  })
})
