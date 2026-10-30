import type {
  Category,
  Device,
  Identification,
  IdentificationEvidence,
  Observation,
} from './types.js';
// Conservative lexical rules: a declared name/model is a clue, never authenticated hardware.
const names: { category: Category; pattern: RegExp }[] = [
  {
    category: 'phone',
    pattern: /(?:^|[\s._-])(iphone|smartphone|telephone|téléphone)(?=$|[\s._-]|\d)/i,
  },
  {
    category: 'computer',
    pattern:
      /(?:^|[\s._-])(macbook(?:pro|air)?|imac|macmini|macpro|ordinateur|desktop|laptop|thinkpad)(?=$|[\s._-]|\d)/i,
  },
  { category: 'tablet', pattern: /(?:^|[\s._-])(ipad|tablet|tablette)(?=$|[\s._-]|\d)/i },
  { category: 'media', pattern: /(?:^|[\s._-])(appletv|apple-tv|chromecast)(?=$|[\s._-]|\d)/i },
  { category: 'storage', pattern: /(?:^|[\s._-])(nas|diskstation)(?=$|[\s._-]|\d)/i },
  {
    category: 'printer',
    pattern: /(?:^|[\s._-])(printer|imprimante|laserjet|officejet)(?=$|[\s._-]|\d)/i,
  },
];
const models: { category: Category; pattern: RegExp }[] = [
  { category: 'phone', pattern: /^iPhone(?:\d|$)/i },
  { category: 'tablet', pattern: /^iPad(?:\d|$)/i },
  {
    category: 'computer',
    pattern: /^(MacBook(?:Pro|Air)?|iMac(?:Pro)?|Macmini|MacPro|MacStudio)(?:\d|$)/i,
  },
  { category: 'media', pattern: /^(AppleTV(?:\d|$)|Chromecast(?:\s|$)|HomePod(?:\d|$))/i },
];
export function identifyDevice(observation: Observation): Identification {
  if (observation.role === 'self')
    return {
      version: 1,
      category: 'computer',
      confidence: 'high',
      reason: 'matched',
      evidence: [{ source: 'local', value: 'Ordinateur exécutant Netarium', category: 'computer' }],
    };
  const evidence: IdentificationEvidence[] = [];
  const candidates = new Set<Category>();
  function add(source: IdentificationEvidence['source'], value: string, category: Category) {
    const bounded = value.slice(0, 160);
    const newCategory = !candidates.has(category);
    candidates.add(category);
    if (evidence.some((e) => e.source === source && e.value === bounded && e.category === category))
      return;
    const item = { source, value: bounded, category };
    if (evidence.length < 16) evidence.push(item);
    else if (newCategory) evidence[evidence.length - 1] = item;
  }
  for (const hostname of new Set([
    observation.hostname,
    ...(observation.services ?? []).map((s) => s.host),
  ])) {
    if (!hostname) continue;
    for (const rule of names)
      if (rule.pattern.test(hostname.slice(0, 253))) add('hostname', hostname, rule.category);
  }
  for (const service of (observation.services ?? []).slice(0, 16)) {
    if (service.model)
      for (const rule of models)
        if (rule.pattern.test(service.model)) add('mdns-model', service.model, rule.category);
    // Broad services (SMB, SSH, HTTP, AirPlay) run on many device types and are not classified.
    if (['ipp', 'ipps', 'printer'].includes(service.type))
      add('mdns-service', `_${service.type}._tcp`, 'printer');
    if (service.type === 'googlecast') add('mdns-service', '_googlecast._tcp', 'media');
  }
  if (candidates.size !== 1)
    return {
      version: 1,
      category: 'unknown',
      confidence: 'none',
      reason: candidates.size ? 'conflicting' : 'insufficient',
      evidence,
    };
  return {
    version: 1,
    category: evidence[0].category,
    confidence: evidence.some((e) => e.source !== 'mdns-service') ? 'medium' : 'low',
    reason: 'matched',
    evidence,
  };
}
// `category` remains the user's annotation. Never overwrite it with an inference.
export function effectiveCategory(device: Pick<Device, 'category' | 'identification'>): Category {
  return device.category !== 'unknown'
    ? device.category
    : (device.identification?.category ?? 'unknown');
}
