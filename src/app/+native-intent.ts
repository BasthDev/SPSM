export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (path.includes('auth/success') || path.includes('auth/failure')) {
      return '/login';
    }
    return path;
  } catch {
    return path;
  }
}
