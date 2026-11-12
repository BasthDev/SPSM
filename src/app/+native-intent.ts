export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const url = new URL(path, 'spsm://app');
    if (url.pathname === '/auth/success' || url.pathname === '/auth/failure') {
      return '/login';
    }
    return path;
  } catch {
    return path;
  }
}
