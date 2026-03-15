/**
 * IndexedDB cache manager for T&C versions and analysis results.
 *
 * Falls back to an in-memory Map when IndexedDB is unavailable
 * (e.g., private browsing mode throws SecurityError).
 */

import { openDB, type IDBPDatabase } from "idb";
import {
  CACHE_DB_NAME,
  CACHE_DB_VERSION,
  CACHE_MAX_ENTRIES,
} from "../shared/constants";
import type { TCVersion, AnalysisResult } from "../shared/types";

interface CacheDB {
  versions: {
    key: string;
    value: TCVersion;
    indexes: { domain: string; fetchedAt: number };
  };
  analyses: {
    key: string;
    value: AnalysisResult;
    indexes: { domain: string; analyzedAt: number };
  };
}

/**
 * Simple in-memory cache used as a fallback when IndexedDB is unavailable.
 */
class InMemoryCache {
  private versions = new Map<string, TCVersion>();
  private analyses = new Map<string, AnalysisResult>();

  getVersion(url: string): TCVersion | undefined {
    return this.versions.get(url);
  }

  getVersionByDomain(domain: string): TCVersion[] {
    return [...this.versions.values()].filter((v) => v.domain === domain);
  }

  saveVersion(version: TCVersion): void {
    this.versions.set(version.url, version);
    this.enforceLimit();
  }

  getAnalysis(url: string): AnalysisResult | undefined {
    return this.analyses.get(url);
  }

  saveAnalysis(result: AnalysisResult): void {
    this.analyses.set(result.url, result);
    this.enforceLimit();
  }

  evictOldest(count: number): void {
    const versionEntries = [...this.versions.entries()].sort(
      (a, b) => a[1].fetchedAt - b[1].fetchedAt
    );
    for (let i = 0; i < Math.min(count, versionEntries.length); i++) {
      this.versions.delete(versionEntries[i][0]);
    }
    const analysisEntries = [...this.analyses.entries()].sort(
      (a, b) => a[1].analyzedAt - b[1].analyzedAt
    );
    for (let i = 0; i < Math.min(count, analysisEntries.length); i++) {
      this.analyses.delete(analysisEntries[i][0]);
    }
  }

  private enforceLimit(): void {
    if (this.versions.size + this.analyses.size > CACHE_MAX_ENTRIES) {
      this.evictOldest(50);
    }
  }
}

export class CacheManager {
  private db: IDBPDatabase<CacheDB> | null = null;
  private fallback: InMemoryCache | null = null;
  private initialized = false;

  /**
   * Open or create the IndexedDB database. Falls back to in-memory
   * cache if IndexedDB throws SecurityError (private browsing).
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await openDB<CacheDB>(CACHE_DB_NAME, CACHE_DB_VERSION, {
        upgrade(db) {
          // Versions store
          if (!db.objectStoreNames.contains("versions")) {
            const versionStore = db.createObjectStore("versions", {
              keyPath: "url",
            });
            versionStore.createIndex("domain", "domain", { unique: false });
            versionStore.createIndex("fetchedAt", "fetchedAt", {
              unique: false,
            });
          }

          // Analyses store
          if (!db.objectStoreNames.contains("analyses")) {
            const analysisStore = db.createObjectStore("analyses", {
              keyPath: "url",
            });
            analysisStore.createIndex("domain", "domain", { unique: false });
            analysisStore.createIndex("analyzedAt", "analyzedAt", {
              unique: false,
            });
          }
        },
      });
      this.initialized = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "SecurityError") {
        console.warn(
          "[fineprint] IndexedDB unavailable (private browsing), using in-memory cache"
        );
        this.fallback = new InMemoryCache();
        this.initialized = true;
      } else {
        throw err;
      }
    }
  }

  /** Get the latest cached TCVersion for a URL. */
  async getVersion(url: string): Promise<TCVersion | undefined> {
    if (this.fallback) return this.fallback.getVersion(url);
    return this.db?.get("versions", url);
  }

  /** Get all cached versions for a domain (useful when URLs change). */
  async getVersionByDomain(domain: string): Promise<TCVersion[]> {
    if (this.fallback) return this.fallback.getVersionByDomain(domain);
    if (!this.db) return [];
    return this.db.getAllFromIndex("versions", "domain", domain);
  }

  /** Store a T&C version. Handles QuotaExceededError by evicting old entries. */
  async saveVersion(version: TCVersion): Promise<void> {
    if (this.fallback) {
      this.fallback.saveVersion(version);
      return;
    }
    try {
      await this.db?.put("versions", version);
    } catch (err) {
      if (isQuotaExceeded(err)) {
        await this.evictOldest(50);
        await this.db?.put("versions", version);
      } else {
        throw err;
      }
    }
  }

  /** Get a cached analysis result for a URL. */
  async getAnalysis(url: string): Promise<AnalysisResult | undefined> {
    if (this.fallback) return this.fallback.getAnalysis(url);
    return this.db?.get("analyses", url);
  }

  /** Store an analysis result. Handles QuotaExceededError by evicting old entries. */
  async saveAnalysis(result: AnalysisResult): Promise<void> {
    if (this.fallback) {
      this.fallback.saveAnalysis(result);
      return;
    }
    try {
      await this.db?.put("analyses", result);
    } catch (err) {
      if (isQuotaExceeded(err)) {
        await this.evictOldest(50);
        await this.db?.put("analyses", result);
      } else {
        throw err;
      }
    }
  }

  /**
   * Remove the oldest entries from both stores to free space.
   * @param count Number of entries to remove from each store.
   */
  async evictOldest(count: number): Promise<void> {
    if (this.fallback) {
      this.fallback.evictOldest(count);
      return;
    }
    if (!this.db) return;

    // Evict oldest versions
    const oldVersions = await this.db.getAllKeysFromIndex(
      "versions",
      "fetchedAt"
    );
    for (let i = 0; i < Math.min(count, oldVersions.length); i++) {
      await this.db.delete("versions", oldVersions[i]);
    }

    // Evict oldest analyses
    const oldAnalyses = await this.db.getAllKeysFromIndex(
      "analyses",
      "analyzedAt"
    );
    for (let i = 0; i < Math.min(count, oldAnalyses.length); i++) {
      await this.db.delete("analyses", oldAnalyses[i]);
    }
  }
}

/** Check if an error is a QuotaExceededError. */
function isQuotaExceeded(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.code === DOMException.QUOTA_EXCEEDED_ERR)
  );
}
