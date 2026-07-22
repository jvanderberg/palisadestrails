const DB_NAME = 'palisades-personal-photos';
const STORE_NAME = 'marker-photos';

function database(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!('indexedDB' in window)) {
			reject(new Error('Photo storage is not available on this device.'));
			return;
		}
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE_NAME))
				request.result.createObjectStore(STORE_NAME);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not open photo storage.'));
	});
}

function request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
	return database().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const transaction = db.transaction(STORE_NAME, mode);
				const operation = action(transaction.objectStore(STORE_NAME));
				operation.onsuccess = () => resolve(operation.result);
				operation.onerror = () =>
					reject(operation.error ?? new Error('Photo storage operation failed.'));
				transaction.oncomplete = () => db.close();
				transaction.onerror = () => db.close();
			}),
	);
}

export function saveMarkerPhoto(markerId: string, photo: Blob): Promise<IDBValidKey> {
	return request('readwrite', (store) => store.put(photo, markerId));
}

export function loadMarkerPhoto(markerId: string): Promise<Blob | undefined> {
	return request('readonly', (store) => store.get(markerId));
}

export function deleteMarkerPhoto(markerId: string): Promise<void> {
	return request('readwrite', (store) => store.delete(markerId));
}
