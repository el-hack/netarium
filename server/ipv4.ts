function numeric(ip: string): number | null {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some((part) => Number(part) > 255))
    return null;
  return ip.split('.').reduce((sum, part) => (sum * 256 + Number(part)) >>> 0, 0);
}
function dotted(value: number) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}
export function isPrivateIPv4(ip: string) {
  const n = numeric(ip);
  return n !== null && (n >>> 24 === 10 || n >>> 20 === 0xac1 || n >>> 16 === 0xc0a8);
}
export function contains(cidr: string, ip: string) {
  const [base, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  const address = numeric(ip),
    network = numeric(base);
  if (
    address === null ||
    network === null ||
    !Number.isInteger(prefix) ||
    prefix < 1 ||
    prefix > 32
  )
    return false;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (network & mask);
}
export function boundedSubnet(address: string, netmask: string) {
  const mask = numeric(netmask);
  if (mask === null || numeric(address) === null) throw new Error('Adresse réseau invalide');
  const bits = mask.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bits)) throw new Error('Masque réseau invalide');
  const prefix = Math.max(24, bits.replace(/0/g, '').length);
  return `${dotted((numeric(address)! & (0xffffffff << (32 - prefix))) >>> 0)}/${prefix}`;
}
export function hosts(cidr: string) {
  const [base, prefix] = cidr.split('/');
  const start = numeric(base)!;
  const size = 2 ** (32 - Number(prefix));
  if (size > 256 || size < 1) throw new Error('Périmètre trop grand');
  return Array.from({ length: size <= 2 ? size : size - 2 }, (_, i) =>
    dotted(start + i + (size <= 2 ? 0 : 1)),
  );
}
