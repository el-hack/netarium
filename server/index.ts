import { mkdir, chmod, readFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import fastifyStatic from '@fastify/static';
import { createApp } from './app.js';
import { Coordinator } from './coordinator.js';
import { Store } from './store.js';
import { executable } from './network.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dataDirectory = resolve(process.env.NETARIUM_DATA_DIR ?? join(root,'.netarium'));
const port = Number(process.env.PORT ?? 4783);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT doit être compris entre 1024 et 65535.');
await mkdir(dataDirectory,{recursive:true,mode:0o700});
await chmod(dataDirectory,0o700);
const store = new Store(join(dataDirectory,'netarium.sqlite'));
await chmod(join(dataDirectory,'netarium.sqlite'),0o600);
const coordinator = new Coordinator(store);
const app = await createApp({store,coordinator,port,logger:true,capabilities:{
  platform:platform(),nmap:Boolean(await executable('nmap')),ping:Boolean(await executable('ping')),neighbor:Boolean(await executable(platform() === 'linux' ? 'ip':'arp')),dataDirectory,version:'0.1.0',
}});
const dev = process.argv.includes('--dev');
if (dev) {
  const {createServer} = await import('vite');
  const vite = await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom'});
  app.addHook('onClose',async () => {await vite.close();});
  app.setNotFoundHandler(async (request,reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({message:'Route inconnue.'});
    const handled = await new Promise<boolean>(resolve => {
      reply.raw.once('finish',() => resolve(true));
      vite.middlewares(request.raw,reply.raw,() => resolve(false));
    });
    if (handled) return reply;
    const html = await vite.transformIndexHtml(request.url,await readFile(join(root,'index.html'),'utf8'));
    return reply.type('text/html').send(html);
  });
} else {
  try {await access(join(root,'dist','index.html'));} catch {throw new Error('Interface non construite. Exécutez npm run build avant npm start.');}
  await app.register(fastifyStatic,{root:join(root,'dist'),wildcard:false});
  app.setNotFoundHandler((request,reply) => request.url.startsWith('/api/') ? reply.code(404).send({message:'Route inconnue.'}) : reply.type('text/html').sendFile('index.html'));
}
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,async () => {
  await app.close(); store.close(); process.exit(0);
});
coordinator.schedule();
try {
  await app.listen({host:'127.0.0.1',port});
  console.info(`\n  Netarium → http://127.0.0.1:${port}\n  Données locales : ${dataDirectory}\n`);
} catch (error) {await app.close(); store.close(); throw error;}
