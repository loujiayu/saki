export function cleanCache(key: string) {
  mockCache.delete(key);
}

export function setCache(key, value) {
  mockCache.set(key, value);
}

export function getCache(key) {
  return mockCache.get(key);
}

export const mockCache = new Map();