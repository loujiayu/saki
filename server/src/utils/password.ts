import * as crypto from 'crypto';

const salt = '12eb651be505871d';

export function hashPassword(password: string): string {
  const hash = crypto.createHmac('sha256', salt);
  hash.update(password);
  return hash.digest('hex');
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword;
}