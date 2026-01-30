// 支持的视频文件扩展名
const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.3gp']

export function useVideoFiles() {
  /**
   * 检查文件是否为视频文件
   */
  function isVideoFile(file: File): boolean {
    const fileName = file.name.toLowerCase()
    return videoExtensions.some(ext => fileName.endsWith(ext))
  }

  /**
   * 过滤出视频文件
   */
  function filterVideoFiles(files: FileList | File[]): File[] {
    const fileArray = Array.from(files)

    return fileArray.filter((file) => {
      // 跳过文件夹（在拖拽时，文件夹会被识别为没有扩展名的文件）
      if (!file.type && !file.name.includes('.')) {
        return false
      }
      return isVideoFile(file)
    })
  }

  /**
   * 递归读取文件夹内的所有文件
   */
  async function readAllFilesInDirectory(directoryEntry: FileSystemDirectoryEntry): Promise<File[]> {
    const reader = directoryEntry.createReader()
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve)
    })

    const promises = entries.map(async (entry) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject)
        })
        return [file]
      }
      else if (entry.isDirectory) {
        return await readAllFilesInDirectory(entry as FileSystemDirectoryEntry)
      }
      return []
    })

    const results = await Promise.all(promises)
    return results.flat()
  }

  /**
   * 处理拖拽的文件和文件夹
   */
  async function handleDroppedFiles(items: DataTransferItemList | null): Promise<File[]> {
    if (!items)
      return []

    // 处理文件夹和文件的混合拖拽
    const filePromises = Array.from(items)
      .filter(item => item.kind === 'file')
      .map(async (item) => {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve) => {
              item.getAsFile?.() && resolve(item.getAsFile()!)
            })
            return file ? [file] : []
          }
          else if (entry.isDirectory) {
            // 递归读取文件夹内的所有文件
            return await readAllFilesInDirectory(entry as FileSystemDirectoryEntry)
          }
        }
        return []
      })

    const allFiles = await Promise.all(filePromises)
    return allFiles.flat()
  }

  return {
    isVideoFile,
    filterVideoFiles,
    handleDroppedFiles,
  }
}
