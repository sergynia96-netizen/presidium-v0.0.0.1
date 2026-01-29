const DB_NAME = "presidium-media";
const STORE_NAME = "attachments";
const KEY_STORAGE = "presidium-media-key";

type StoredMedia = {
  id: string;
  data: ArrayBuffer;
  iv: Uint8Array;
  mimeType: string;
  createdAt: number;
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getStore = async (mode: IDBTransactionMode) => {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, mode);
  return { store: tx.objectStore(STORE_NAME), tx };
};

const bufferToBase64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const base64ToBuffer = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0)).buffer;

const getCryptoKey = async () => {
  const cached = localStorage.getItem(KEY_STORAGE);
  if (cached) {
    const raw = base64ToBuffer(cached);
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem(KEY_STORAGE, bufferToBase64(raw));
  return key;
};

const compressBlob = async (blob: Blob) => {
  if (!("CompressionStream" in window)) {
    return blob;
  }
  const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
};

const decompressBlob = async (blob: Blob) => {
  if (!("DecompressionStream" in window)) {
    return blob;
  }
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).blob();
};

export const saveMedia = async (blob: Blob) => {
  const key = await getCryptoKey();
  const compressed = await compressBlob(blob);
  const data = await compressed.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const id = crypto.randomUUID();

  const stored: StoredMedia = {
    id,
    data: encrypted,
    iv,
    mimeType: blob.type,
    createdAt: Date.now()
  };

  const { store, tx } = await getStore("readwrite");
  store.put(stored);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return { id, mimeType: blob.type };
};

export const loadMedia = async (id: string) => {
  const key = await getCryptoKey();
  const { store, tx } = await getStore("readonly");
  const request = store.get(id);

  const stored = await new Promise<StoredMedia | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (!stored) {
    return null;
  }

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, key, stored.data);
  const blob = new Blob([decrypted], { type: stored.mimeType });
  return decompressBlob(blob);
};

export const deleteMedia = async (id?: string) => {
  if (!id) return;
  const { store, tx } = await getStore("readwrite");
  store.delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
