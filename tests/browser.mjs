import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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
server.stderr.on('data', (chunk) => {
  serverLog += chunk;
});
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) break;
    } catch {}
    if (server.exitCode !== null) throw new Error(`Test server stopped: ${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  console.log('Starting browser checks');
  await page.goto(origin);
  await expect(page.getByText('Votre inventaire commence ici')).toBeVisible();
  await page.getByRole('button', { name: 'Découvrir le réseau', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.waitForTimeout(2300);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Recentrer la carte' }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Détails de nas.local', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const drawerAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.deepEqual(
    drawerAudit.violations.map((violation) => violation.id),
    [],
    'Device drawer accessibility',
  );
  await page.getByLabel('Nom personnalisé').fill('NAS du bureau');
  await page.getByLabel('Catégorie', { exact: true }).selectOption('storage');
  await page.getByLabel('Notes', { exact: true }).fill('Sauvegardes familiales');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Détails de NAS du bureau' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Détails de NAS du bureau' })).toBeVisible();
  await page.getByLabel('Rechercher un appareil').fill('NAS du bureau');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Rechercher un appareil').fill('');
  await page.getByRole('button', { name: 'Découvrir le réseau', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5, { timeout: 15000 });
  console.log('Discovery, editing and persistence passed');
  await page.getByRole('button', { name: 'Chronologie', exact: true }).click();
  await expect(page.locator('.scan-timeline li')).toHaveCount(2);
  const comparison = page.getByLabel('Comparer l’instantané sélectionné avec');
  await comparison.selectOption({ index: 1 });
  await expect(page.locator('.diff-stats')).toBeVisible();
  await expect(page.locator('.diff-stats')).toContainText('1 nouveaux');
  await expect(page.locator('.diff-stats')).toContainText('1 non revus');
  await expect(page.locator('.diff-stats')).toContainText('1 modifiés');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByLabel('Interface de collecte automatique').selectOption(networkId());
  await page.getByLabel('Fréquence de découverte').selectOption('15');
  await page.getByLabel('Conservation de l’historique').selectOption('90');
  await page.getByRole('button', { name: 'Enregistrer les préférences' }).click();
  await expect(page.getByRole('status')).toContainText('enregistrées');
  await page.reload();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByLabel('Fréquence de découverte')).toHaveValue('15');
  await expect(page.getByLabel('Conservation de l’historique')).toHaveValue('90');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exporter CSV', exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.csv'));
  console.log('History, settings and export passed');
  const violations = [];
  for (const name of ['Observatoire', 'Appareils', 'Chronologie', 'Réglages']) {
    console.log(`Accessibility: ${name}`);
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(200);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    for (const violation of result.violations)
      violations.push({
        page: name,
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes
          .slice(0, 4)
          .map((n) => ({ html: n.html, summary: n.failureSummary })),
      });
  }
  await page.getByRole('button', { name: 'Observatoire', exact: true }).click();
  for (const width of [1440, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Page overflows at ${width}px`,
    );
  }
  await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
  await page.getByRole('button', { name: 'Appareils', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chaque appareil a sa place.' })).toBeVisible();
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  assert.deepEqual(consoleErrors, [], 'Browser console errors');
  console.log(
    JSON.stringify(
      {
        status: violations.length ? 'accessibility-failures' : 'passed',
        checks: [
          'discovery',
          '3D/2D',
          'device annotations',
          'persistence',
          'search',
          'history comparison',
          'settings persistence',
          'CSV export',
          '4-page accessibility',
          '5 viewport widths',
          'mobile navigation',
        ],
        violations,
      },
      null,
      2,
    ),
  );
  assert.equal(violations.length, 0, 'Accessibility violations');
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
function networkId() {
  return 'test0:192.168.50.2';
}
