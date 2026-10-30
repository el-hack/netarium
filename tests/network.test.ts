import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundedSubnet,
  isPrivateIPv4,
  contains,
  parseNeighbors,
  parseNmap,
} from '../server/network.js';

test('scan scope stays within the attached subnet and at most 256 addresses', () => {
  assert.equal(boundedSubnet('192.168.7.64', '255.255.0.0'), '192.168.7.0/24');
  assert.equal(boundedSubnet('10.0.1.41', '255.255.255.240'), '10.0.1.32/28');
  assert.equal(contains('10.0.1.32/28', '10.0.1.48'), false);
});
test('only private home IPv4 addresses are eligible', () => {
  for (const ip of ['192.168.1.1', '10.3.2.1', '172.31.1.2']) assert.equal(isPrivateIPv4(ip), true);
  for (const ip of ['8.8.8.8', '127.0.0.1', '169.254.1.1', '10.1.1.999', '172.32.0.1'])
    assert.equal(isPrivateIPv4(ip), false);
});
test('neighbor cache is evidence of a cached neighbor, not live availability', () => {
  const entries = parseNeighbors(
    '? (192.168.1.1) at a:b:c:d:e:f on en0 ifscope [ethernet]\n? (192.168.1.2) at (incomplete) on en0\n? (224.0.0.251) at 1:0:5e:0:0:fb on en0',
    '192.168.1.0/24',
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].mac, '0a:0b:0c:0d:0e:0f');
  assert.equal(entries[0].reachable, false);
});
test('parses Linux and Windows neighbor tables', () => {
  assert.equal(
    parseNeighbors('192.168.1.8 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE', '192.168.1.0/24')
      .length,
    1,
  );
  assert.equal(
    parseNeighbors('  192.168.1.9       aa-bb-cc-dd-ee-11     dynamic', '192.168.1.0/24').length,
    1,
  );
});
test('Nmap XML retains only responding hosts within the selected scope', () => {
  const xml =
    '<nmaprun><host><status state="up"/><address addr="192.168.1.5" addrtype="ipv4"/><address addr="AA:BB:CC:DD:EE:FF" addrtype="mac" vendor="Example"/><hostnames><hostname name="nas.local"/></hostnames></host><host><status state="down"/><address addr="192.168.1.6" addrtype="ipv4"/></host><host><status state="up"/><address addr="8.8.8.8" addrtype="ipv4"/></host></nmaprun>';
  const entries = parseNmap(xml, '192.168.1.0/24');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].hostname, 'nas.local');
  assert.equal(entries[0].source, 'nmap');
});
