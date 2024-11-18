// db.js
import { openDB } from 'idb';

const DB_NAME = 'arxivTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'searches';

const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const saveSearch = async (query, papers) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.add({ query, papers, timestamp: Date.now() });
  await tx.done;
};

export const getSearches = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const searches = await tx.store.getAll();
  await tx.done;
  return searches;
};