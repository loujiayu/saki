export function invariant(check: boolean, message: string) {
  if (!check)
      throw new Error(message);
}

export const Saki_JWT = 'saki-jwt';
export const Saki_USER = 'saki-user';