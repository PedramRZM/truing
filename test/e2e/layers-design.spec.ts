// The Design view of the layers (TRU-3.6), on the fixture's /layers.
import { frame } from './fixtures';
import { expect, modeButton, test } from './inspect-fixture';

const tree = (shell: import('@playwright/test').Page) =>
  shell.getByRole('navigation', { name: 'Layers of the Desktop frame' });

async function openLayers(
  shell: import('@playwright/test').Page,
  shellOrigin: string,
) {
  await shell.goto(`${shellOrigin}/?route=/layers`);
  await tree(shell)
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  await expect(tree(shell)).toContainText('Wrapped heading');
  await modeButton(shell, 'Select').click();
}

test('Design starts where the page starts, and Code keeps the whole tree', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  await expect(tree(shell)).not.toContainText('Provider');
  await expect(tree(shell)).not.toContainText('<body>');
  await expect(tree(shell)).toContainText('Question card');
  // An <svg> holds its paths, and is still drawn, as one row.
  await expect(
    tree(shell).locator('.layer-name[data-icon="icon"]'),
  ).toHaveCount(1);

  await tree(shell).getByRole('button', { name: 'Code', exact: true }).click();
  await expect(tree(shell)).toContainText('<body>');
  await expect(tree(shell)).toContainText('SessionProvider');
});

test('a pick stays in sync across the canvas and both views', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  const app = frame(shell, 'Desktop');

  await app.getByRole('heading', { name: 'Wrapped heading' }).click();
  const current = tree(shell).locator('[aria-current="true"]');
  await expect(current).toContainText('Wrapped heading');

  await tree(shell).getByRole('button', { name: 'Code', exact: true }).click();
  await expect(current).toContainText('Wrapped heading');

  await tree(shell)
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  await tree(shell)
    .getByRole('button', { name: 'Save', exact: true })
    .first()
    .click();
  await expect(current).toContainText('Save');
  await tree(shell).getByRole('button', { name: 'Code', exact: true }).click();
  await expect(current).toContainText('<button>');
});

test('the choice of view survives a reload', async ({ shell, truing }) => {
  await openLayers(shell, truing.session.shellOrigin);
  const code = tree(shell).getByRole('button', { name: 'Code', exact: true });
  await code.click();
  await expect(tree(shell)).toContainText('<body>');
  await shell.reload();
  await expect(code).toHaveAttribute('aria-pressed', 'true');
  await expect(tree(shell)).toContainText('<body>');
});

test('Persian text names its rows, right-aligned included', async ({
  shell,
  truing,
}) => {
  await openLayers(shell, truing.session.shellOrigin);
  await expect(tree(shell)).toContainText('سلام دنیا');
  await expect(tree(shell)).toContainText('این یک متن فارسی است');
  await expect(tree(shell)).toContainText('تصویر آزمایشی');
});

test('the filter matches what a row shows', async ({ shell, truing }) => {
  await openLayers(shell, truing.session.shellOrigin);
  const filter = shell.getByRole('searchbox', { name: 'Filter layers' });
  await filter.fill('سلام');
  await expect(tree(shell)).toContainText('سلام دنیا');
  await expect(tree(shell)).not.toContainText('Wrapped heading');
  await filter.fill('section');
  await expect(tree(shell)).toContainText('No layers match');
});
