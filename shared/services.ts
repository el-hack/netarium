/** Port conventions are weak clues, never proof of an application or encrypted content. */
export function serviceHint(port: number | null, protocol: string | null) {
  if (port === null) return null;
  const names: Record<number, string> = {
    22: 'SSH',
    53: 'DNS',
    80: 'HTTP',
    443: 'HTTPS',
    445: 'SMB',
    853: 'DNS chiffré',
    5353: 'mDNS',
  };
  const name = names[port];
  return name ? `${name} possible · port ${port}${protocol ? `/${protocol}` : ''}` : null;
}
