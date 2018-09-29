import * as redis from 'redis';
import * as util from 'util';

const redisURL = 'redis://127.0.0.1:6379';
const redisClient = redis.createClient(redisURL);

redisClient.hget = util.promisify(redisClient.hget);
redisClient.del = util.promisify(redisClient.del);
redisClient.hset = util.promisify(redisClient.hset);

export function cleanCache(key: string) {
  redisClient.del(key);
}

export async function setCache(hashKey, key, value) {
  await redisClient.hset(hashKey, key, JSON.stringify(value));
}

export async function getCache(hashKey, key) {
  return JSON.parse(await redisClient.hget(hashKey, key));
}
