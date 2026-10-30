import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifyDevice, effectiveCategory } from '../shared/identification.js';
import type { Observation } from '../shared/types.js';
const observation = (change: Partial<Observation> = {}): Observation => ({
  ip: '192.168.1.1',
  mac: null,
  hostname: null,
  vendor: null,
  source: 'ping',
  reachable: true,
  role: 'device',
  ...change,
});
test('a gateway, Apple vendor, private MAC or subnet cannot establish a hardware type', () => {
  const result = identifyDevice(
    observation({ role: 'gateway', vendor: 'Apple', mac: '02:00:00:00:00:01', ip: '172.20.10.1' }),
  );
  assert.equal(result.category, 'unknown');
  assert.equal(result.confidence, 'none');
});
test('the local desktop is known without trusting its hostname', () => {
  assert.equal(
    identifyDevice(observation({ role: 'self', hostname: 'iPhone.local' })).category,
    'computer',
  );
  assert.equal(identifyDevice(observation({ role: 'self' })).confidence, 'high');
});
test('recognizes explicit device names with bounded tokens, including hotspot phones', () => {
  for (const [hostname, category] of [
    ['iPhone-de-Lea.local', 'phone'],
    ['MacBook-Pro.local', 'computer'],
    ['iPad.local', 'tablet'],
    ['NAS-bureau.local', 'storage'],
  ]) {
    const result = identifyDevice(observation({ hostname, role: 'gateway' }));
    assert.equal(result.category, category);
    assert.equal(result.confidence, 'medium');
    assert.equal(result.evidence[0].source, 'hostname');
  }
  for (const hostname of [
    'pineapple.local',
    'nascar.local',
    'android.local',
    'Samsung.local',
    'tvremote.local',
  ])
    assert.equal(identifyDevice(observation({ hostname })).category, 'unknown');
});
test('generic sharing and AirPlay are not proof of hardware type', () => {
  for (const type of ['smb', 'airplay', 'raop', 'http', 'companion-link'])
    assert.equal(
      identifyDevice(
        observation({ services: [{ type, name: 'Salon', host: 'salon.local', model: null }] }),
      ).category,
      'unknown',
    );
});
test('uses advertised model and explains the evidence without treating a service name as a model', () => {
  const result = identifyDevice(
    observation({
      services: [{ type: 'airplay', name: 'Salon', host: 'salon.local', model: 'AppleTV6,2' }],
    }),
  );
  assert.equal(result.category, 'media');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.evidence[0].source, 'mdns-model');
  assert.equal(
    identifyDevice(
      observation({
        services: [{ type: 'airplay', name: 'iPhone', host: 'salon.local', model: null }],
      }),
    ).category,
    'unknown',
  );
});
test('contradictory identifiers stay unknown instead of choosing a misleading icon', () => {
  const result = identifyDevice(
    observation({
      hostname: 'iPhone.local',
      services: [
        { type: 'device-info', name: 'Mac', host: 'iPhone.local', model: 'MacBookPro18,1' },
      ],
    }),
  );
  assert.equal(result.category, 'unknown');
  assert.equal(result.reason, 'conflicting');
  assert.equal(result.evidence.length, 2);
});
test('manual choices take precedence and automatic mode restores the inference', () => {
  const identification = identifyDevice(observation({ hostname: 'iPhone.local' }));
  assert.equal(effectiveCategory({ category: 'computer', identification }), 'computer');
  assert.equal(effectiveCategory({ category: 'unknown', identification }), 'phone');
  assert.equal(effectiveCategory({ category: 'unknown' }), 'unknown');
});

test('truncating displayed evidence does not hide a conflicting category', () => {
  const services = Array.from({ length: 16 }, (_, i) => ({
    type: 'device-info',
    name: '',
    host: `MacBook-${i}.local`,
    model: i === 15 ? 'iPhone15,2' : null,
  }));
  const result = identifyDevice(observation({ services }));
  assert.equal(result.category, 'unknown');
  assert.equal(result.reason, 'conflicting');
});
