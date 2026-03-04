export function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

export function openIndexedDb(
  name: string,
  version: number,
  onUpgrade: (database: IDBDatabase, oldVersion: number, newVersion: number | null) => void,
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version)

    request.onupgradeneeded = (event) => {
      const versionEvent = event as IDBVersionChangeEvent
      onUpgrade(request.result, versionEvent.oldVersion, versionEvent.newVersion)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'))
    }
  })
}
