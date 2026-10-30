import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dataDirectory = await mkdtemp(join(tmpdir(), 'netarium-e2e-'));
const port = Number(process.env.E2E_PORT ?? 4784);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'tests/browser-server.ts'], {
  env: { ...process.env, PORT: String(port), NETARIUM_DATA_DIR: dataDirectory },
  stdio: 'pipe',
});
let serverLog = '';
server.stderr.on('data', (c) => (serverLog += c));
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) break;
    } catch {}
    if (server.exitCode !== null) throw new Error(serverLog);
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const nav = async (name) => {
    if (await page.getByRole('button', { name: 'Ouvrir la navigation', exact: true }).isVisible())
      await page.getByRole('button', { name: 'Ouvrir la navigation', exact: true }).click();
    await page.locator('.workspace-sidebar nav button').filter({ hasText: name }).click();
    await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
  };
  const violations = [];
  const audit = async (label) => {
    if (label.startsWith('Network Explorer'))
      await expect(page.locator('.scene-labels[data-ready="true"]')).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    for (const v of result.violations)
      violations.push({
        page: label,
        id: v.id,
        nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
      });
  };
  console.log('Browser: onboarding and real API discovery');
  await page.goto(origin);
  await expect(page.getByText('Votre inventaire commence ici')).toBeVisible();
  await page.getByRole('button', { name: 'Découvrir le réseau', exact: true }).click();
  await expect(page.locator('.overview-devices button')).toHaveCount(4, { timeout: 15000 });
  await nav('Devices');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.locator('tbody tr').filter({ hasText: 'iphone.local' })).toContainText(
    'Téléphone probable',
  );
  await page.getByRole('button', { name: 'Détails de iphone.local', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('iPhone15,2');
  await audit('device drawer');
  await page.getByLabel('Catégorie', { exact: true }).selectOption('tablet');
  await page.getByLabel('Tags (séparés par des virgules)').fill('Personnel, Téléphone');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'iphone.local' })).toContainText(
    'Tablette · choix manuel',
  );
  await page.getByRole('button', { name: 'Détails de nas.local', exact: true }).click();
  await page.getByLabel('Nom personnalisé').fill('NAS du bureau');
  await page.getByLabel('Catégorie', { exact: true }).selectOption('storage');
  await page.getByLabel('Notes', { exact: true }).fill('Sauvegardes familiales');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Détails de NAS du bureau' })).toBeVisible();
  await page.getByLabel('Rechercher un appareil').fill('Téléphone');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Rechercher un appareil').fill('');
  console.log('Browser: network explorer, persisted 2D layout and activity navigation');
  await nav('Network Explorer');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Recentrer la carte' }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  const node = page.getByRole('button', { name: 'Sélectionner NAS du bureau', exact: true });
  await node.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Position enregistrée.')).toBeVisible();
  const transform = await node.getAttribute('transform');
  await page.reload();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sélectionner NAS du bureau', exact: true }),
  ).toHaveAttribute('transform', transform);
  await page.getByRole('button', { name: 'Sélectionner NAS du bureau', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page
    .locator('.explorer-inspector')
    .getByRole('button', { name: 'Activity Explorer' })
    .click();
  await expect(page.locator('.device-masthead')).toContainText('NAS du bureau');
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByText('Aucune application identifiée')).toBeVisible();
  console.log('Browser: explicit consent and ingestion');
  await nav('Data Sources');
  const agentRow = page.locator('.source-row').filter({ hasText: 'Agent local · processus' });
  await agentRow.getByRole('button', { name: 'Configurer' }).click();
  await expect(page.getByRole('dialog')).toContainText('Aucune inspection du contenu');
  await page.getByRole('button', { name: 'J’autorise la collecte sur cet ordinateur' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(agentRow.getByRole('button', { name: 'Arrêter' })).toBeVisible();
  await page
    .getByLabel('Appareil associé')
    .selectOption({ label: 'ordinateur.local · 192.168.50.2' });
  await page.getByLabel('Fichier d’observations JSON').setInputFiles({
    name: 'dns.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([{ timestamp: new Date().toISOString(), domain: 'example.org' }]),
    ),
  });
  await page.getByLabel('Je confirme que ce journal concerne l’appareil sélectionné.').check();
  await page.getByRole('button', { name: 'Valider et importer' }).click();
  await expect(
    page.getByText('1 observations ajoutées ; les doublons ont été ignorés.'),
  ).toBeVisible();
  await nav('Activity Explorer');
  await page.getByLabel('Appareil analysé').selectOption({ label: 'ordinateur.local' });
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('Test Browser');
  await page.getByRole('button', { name: 'Websites & Domains', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('example.org');
  await page.locator('summary.source-badge').first().click();
  await expect(page.getByText('Déclaré par import')).toBeVisible();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('203.0.113.10');
  await nav('Data Sources');
  await page
    .locator('.source-row')
    .filter({ hasText: 'Agent local · processus' })
    .getByRole('button', { name: 'Arrêter' })
    .click();
  await expect(
    page
      .locator('.source-row')
      .filter({ hasText: 'Agent local · processus' })
      .getByRole('button', { name: 'Configurer' }),
  ).toBeVisible();
  console.log('Browser: snapshots, alerts, privacy, command palette');
  await page.getByRole('button', { name: 'Découvrir le réseau', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Découvrir le réseau', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await nav('Network Timeline');
  await page.getByLabel('Comparer l’instantané sélectionné avec').selectOption({ index: 1 });
  await expect(page.locator('.diff-stats')).toContainText('1 nouveaux');
  await expect(page.locator('.diff-stats')).toContainText('1 non revus');
  await expect(page.locator('.diff-stats')).toContainText('1 modifiés');
  await nav('Security & Alerts');
  await page.getByRole('button', { name: 'Traiter', exact: true }).first().click();
  await page.getByLabel('État des alertes').selectOption('acknowledged');
  await expect(page.getByRole('button', { name: 'Rouvrir', exact: true })).toBeVisible();
  await nav('Settings');
  await page.getByRole('button', { name: 'Supprimer le journal d’activité', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Supprimer définitivement' })).toBeDisabled();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: 'Recherche globale', exact: true }).click();
  await page.getByLabel('Rechercher dans Netarium').fill('NAS du bureau');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /NAS du bureau/ })
    .click();
  await expect(page.locator('.device-masthead')).toContainText('NAS du bureau');
  console.log('Browser: demo isolation and all pages in both themes');
  await page.getByRole('button', { name: 'Explorer la démo', exact: true }).click();
  await expect(page.locator('.demo-banner')).toBeVisible();
  await expect(page.locator('.scan-progress')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Découvrir le réseau', exact: true }),
  ).toBeDisabled();
  const demoRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) demoRequests.push(r.url());
  });
  const names = [
    'Overview',
    'Network Explorer',
    'Activity Explorer',
    'Devices',
    'Traffic Analytics',
    'Network Timeline',
    'Security & Alerts',
    'Data Sources',
    'Settings',
  ];
  for (const theme of ['dark', 'light']) {
    if (theme === 'light')
      await page.getByRole('button', { name: 'Activer le mode clair' }).click();
    for (const name of names) {
      await nav(name);
      if (name === 'Activity Explorer' && (await page.locator('.device-picker').isVisible())) {
        await page
          .locator('.device-picker')
          .getByRole('button', { name: /MacBook Studio/ })
          .click();
      }
      console.log(`Audit: ${name} ${theme}`);
      await audit(`${name} ${theme}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${name} ${theme} overflow`,
      );
    }
  }
  assert.deepEqual(demoRequests, [], 'Demo must issue no API requests');
  await page.getByRole('button', { name: 'Activer le mode sombre' }).click();
  await nav('Overview');
  await page.screenshot({ path: '../netarium-apercu.png', fullPage: true, animations: 'disabled' });
  await nav('Activity Explorer');
  await page.getByRole('button', { name: 'Vue générale', exact: true }).click();
  await page.screenshot({
    path: '../netarium-activity.png',
    fullPage: true,
    animations: 'disabled',
  });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const name of names) {
      await nav(name);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${name} overflows at ${width}`,
      );
      if (width === 320) await audit(`${name} mobile`);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await nav('Overview');
  await page.screenshot({ path: '../netarium-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Ouvrir la navigation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation principale' })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Quitter la démo', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Fermer la navigation', exact: true }).last(),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Ouvrir la navigation', exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: 'Quitter la démo', exact: true }).click();
  await nav('Devices');
  await page.getByRole('button', { name: 'Détails de NAS du bureau', exact: true }).click();
  await page.getByLabel('Nom personnalisé').fill('Modification non enregistrée');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Conserver vos modifications ?')).toBeVisible();
  await page.getByRole('button', { name: 'Abandonner les modifications' }).click();
  await writeFile(
    '/tmp/netarium-browser-report.json',
    JSON.stringify({ violations, errors }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        status: violations.length || errors.length ? 'failed' : 'passed',
        axeAudits: 28,
        viewports: 5,
        violations,
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(violations, [], 'Accessibility findings');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    setTimeout(resolve, 5000).unref();
  });
  await rm(dataDirectory, { recursive: true, force: true });
}
