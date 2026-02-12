// 支持的视频文件扩展名
const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.3gp']
// 支持的图片文件扩展名
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic']

export function useVideoFiles() {
  function hasExtension(file: File, extensions: string[]): boolean {
    const fileName = file.name.toLowerCase()
    return extensions.some(ext => fileName.endsWith(ext))
  }

  /**
   * 检查文件是否为视频文件
   */
  function isVideoFile(file: File): boolean {
    if (file.type.toLowerCase().startsWith('video/'))
      return true
    return hasExtension(file, videoExtensions)
  }

  /**
   * 检查文件是否为图片文件
   */
  function isImageFile(file: File): boolean {
    if (file.type.toLowerCase().startsWith('image/'))
      return true
    return hasExtension(file, imageExtensions)
  }

  /**
   * 检查拖拽项是否只是目录占位
   */
  function isDirectoryPlaceholder(file: File): boolean {
    return !file.type && !file.name.includes('.')
  }

  /**
   * 过滤出视频文件
   */
  function filterVideoFiles(files: FileList | File[]): File[] {
    return Array.from(files).filter(file => !isDirectoryPlaceholder(file) && isVideoFile(file))
  }

  /**
   * 过滤出图片文件
   */
  function filterImageFiles(files: FileList | File[]): File[] {
    return Array.from(files).filter(file => !isDirectoryPlaceholder(file) && isImageFile(file))
  }

  /**
   * 过滤出支持的媒体文件
   */
  function filterMediaFiles(files: FileList | File[]): File[] {
    return Array.from(files).filter(file => !isDirectoryPlaceholder(file) && (isVideoFile(file) || isImageFile(file)))
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
    isImageFile,
    filterVideoFiles,
    filterImageFiles,
    filterMediaFiles,
    handleDroppedFiles,
  }
}
