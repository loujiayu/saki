export function invariant(check: boolean, message: string) {
  if (!check)
      throw new Error(message);
}

export const SAKE_JWT = 'sake-jwt';
export const SAKE_USER = 'sake-user';