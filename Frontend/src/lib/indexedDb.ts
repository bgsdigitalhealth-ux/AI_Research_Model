import {
  CachedOfflineQuestionnaire,
  LocalSurveyDraft,
  QueuedSubmission,
  ConsentRecord,
} from '@/types/dataCollection';

const DB_NAME = 'AI_Research_Flow_Offline_DB';
const DB_VERSION = 1;

interface OfflineDbStores {
  cachedQuestionnaires: CachedOfflineQuestionnaire;
  localDrafts: LocalSurveyDraft;
  submissionQueue: QueuedSubmission;
  consentRecords: ConsentRecord;
}

class IndexedDbClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Cached Published Questionnaires
        if (!db.objectStoreNames.contains('cachedQuestionnaires')) {
          const qStore = db.createObjectStore('cachedQuestionnaires', { keyPath: 'id' });
          qStore.createIndex('version', 'version', { unique: false });
        }

        // 2. Local In-Progress Response Drafts
        if (!db.objectStoreNames.contains('localDrafts')) {
          const draftStore = db.createObjectStore('localDrafts', { keyPath: 'id' });
          draftStore.createIndex('questionnaireId', 'questionnaireId', { unique: false });
          draftStore.createIndex('lastSavedAt', 'lastSavedAt', { unique: false });
        }

        // 3. Offline Submission Queue
        if (!db.objectStoreNames.contains('submissionQueue')) {
          const subStore = db.createObjectStore('submissionQueue', { keyPath: 'id' });
          subStore.createIndex('status', 'status', { unique: false });
          subStore.createIndex('questionnaireId', 'questionnaireId', { unique: false });
          subStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 4. Participant Consent Records
        if (!db.objectStoreNames.contains('consentRecords')) {
          const consentStore = db.createObjectStore('consentRecords', { keyPath: 'id' });
          consentStore.createIndex('questionnaireId', 'questionnaireId', { unique: false });
          consentStore.createIndex('participantIdentifier', 'participantIdentifier', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- 1. Cached Questionnaires ---
  async saveCachedQuestionnaire(item: CachedOfflineQuestionnaire): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cachedQuestionnaires', 'readwrite');
      const store = tx.objectStore('cachedQuestionnaires');
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedQuestionnaires(): Promise<CachedOfflineQuestionnaire[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cachedQuestionnaires', 'readonly');
      const store = tx.objectStore('cachedQuestionnaires');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedQuestionnaireById(id: string): Promise<CachedOfflineQuestionnaire | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cachedQuestionnaires', 'readonly');
      const store = tx.objectStore('cachedQuestionnaires');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async removeCachedQuestionnaire(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cachedQuestionnaires', 'readwrite');
      const store = tx.objectStore('cachedQuestionnaires');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- 2. In-Progress Local Survey Drafts ---
  async saveLocalDraft(draft: LocalSurveyDraft): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('localDrafts', 'readwrite');
      const store = tx.objectStore('localDrafts');
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getLocalDraft(id: string): Promise<LocalSurveyDraft | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('localDrafts', 'readonly');
      const store = tx.objectStore('localDrafts');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteLocalDraft(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('localDrafts', 'readwrite');
      const store = tx.objectStore('localDrafts');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- 3. Offline Submission Queue ---
  async enqueueSubmission(submission: QueuedSubmission): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submissionQueue', 'readwrite');
      const store = tx.objectStore('submissionQueue');
      const req = store.put(submission);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getQueuedSubmissions(): Promise<QueuedSubmission[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submissionQueue', 'readonly');
      const store = tx.objectStore('submissionQueue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async updateSubmission(id: string, patch: Partial<QueuedSubmission>): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submissionQueue', 'readwrite');
      const store = tx.objectStore('submissionQueue');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        if (!getReq.result) {
          reject(new Error(`Submission record ${id} not found in local queue.`));
          return;
        }
        const updated = { ...getReq.result, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async removeSubmission(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submissionQueue', 'readwrite');
      const store = tx.objectStore('submissionQueue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- 4. Consent Records ---
  async saveConsentRecord(record: ConsentRecord): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consentRecords', 'readwrite');
      const store = tx.objectStore('consentRecords');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getConsentRecord(id: string): Promise<ConsentRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consentRecords', 'readonly');
      const store = tx.objectStore('consentRecords');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Device Cleanup Helper ---
  async clearAllLocalData(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['cachedQuestionnaires', 'localDrafts', 'submissionQueue', 'consentRecords'],
        'readwrite'
      );
      tx.objectStore('cachedQuestionnaires').clear();
      tx.objectStore('localDrafts').clear();
      tx.objectStore('submissionQueue').clear();
      tx.objectStore('consentRecords').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDb = new IndexedDbClient();

