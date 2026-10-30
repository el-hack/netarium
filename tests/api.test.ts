import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import { Coordinator } from '../server/coordinator.js';
import { createApp } from '../server/app.js';
const network = {id:'en0:192.168.1.2',name:'en0',address:'192.168.1.2',mac:'aa:bb:cc:dd:ee:ff',cidr:'192.168.1.0/24',scanCidr:'192.168.1.0/24',gateway:'192.168.1.1'};
const host = {host:'127.0.0.1:4783'};
const write = {...host,'x-netarium-client':'1',origin:'http://127.0.0.1:4783'};
async function fixture() {
  const store = new Store(':memory:');
  const coordinator = new Coordinator(store,async () => ({observations:[],warnings:[]}),async () => [network]);
  const app = await createApp({store,coordinator,port:4783,listInterfaces:async () => [network],capabilities:{platform:'test',nmap:false,ping:true,neighbor:true,dataDirectory:':memory:',version:'0.1.0'}});
  return {app,store,coordinator};
}
test('rejects DNS rebinding hosts and cross-origin mutations', async () => {
  const {app,store} = await fixture();
  assert.equal((await app.inject({url:'/api/overview',headers:{host:'attacker.example:4783'}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/api/scans',headers:{...write,origin:'https://attacker.example'},payload:{interfaceId:network.id}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/api/scans',headers:host,payload:{interfaceId:network.id}})).statusCode,403);
  await app.close(); store.close();
});
test('rejects arbitrary scan targets and invalid settings', async () => {
  const {app,store} = await fixture();
  const invalid = await app.inject({method:'POST',url:'/api/scans',headers:write,payload:{interfaceId:'8.8.8.8/24'}});
  assert.equal(invalid.statusCode,400);
  const settings = await app.inject({method:'PUT',url:'/api/settings',headers:write,payload:{intervalMinutes:1,retentionDays:0,interfaceId:network.id}});
  assert.equal(settings.statusCode,400);
  assert.equal(store.scans().length,0);
  await app.close(); store.close();
});
test('supports a real API lifecycle and an immutable snapshot', async () => {
  const {app,store} = await fixture();
  const scan = await app.inject({method:'POST',url:'/api/scans',headers:write,payload:{interfaceId:network.id}});
  assert.equal(scan.statusCode,202);
  await new Promise(resolve => setImmediate(resolve));
  const snapshot = await app.inject({url:`/api/snapshots/${scan.json().id}`,headers:host});
  assert.equal(snapshot.statusCode,200);
  assert.deepEqual(snapshot.json().devices,[]);
  assert.equal((await app.inject({url:'/api/export?format=csv',headers:host})).headers['content-type'],'text/csv; charset=utf-8');
  await app.close(); store.close();
});
test('concurrent scan requests do not launch overlapping collectors', async () => {
  const store = new Store(':memory:');
  let release: () => void = () => {};
  const coordinator = new Coordinator(store,async () => { await new Promise<void>(resolve => {release = resolve;}); return {observations:[],warnings:[]}; },async () => [network]);
  await coordinator.start(network.id);
  await assert.rejects(coordinator.start(network.id),{statusCode:409});
  release(); await coordinator.close(); store.close();
});
