export function invariant(check: boolean, message: string) {
  if (!check)
      throw new Error(message);
}