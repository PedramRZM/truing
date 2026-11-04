// What a real app has and a bare fixture doesn't, through the shell: a sign-in
// redirect, a service worker, its own breakpoints, and the inspector on Turbopack
// (TRU-2.1). All on the fixture's /real-app page, run on Turbopack.
import {
  appFrame,
  chooseViewport,
  expect,
  frame,
  frameStatus,
  realAppTest as test,
} from './fixtures';

test('the sign-in redirect returns to the app, not to Truing', async ({
  shell,
  truing,
}) => {
  const app = truing.session.appOrigin;
  // The frame's own request to the login route goes to the app as usual; its
  // redirect is read and not followed, so the identity provider is never
  // reached. (Route handlers never see a redirect's next hop, only its start.)
  const location = new Promise<string>((resolve) => {
    void truing.context.route(`${app}/api/auth/login`, async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      resolve(response.headers()['location'] ?? '');
      await route.fulfill({ status: 204 });
    });
  });

  const routeBox = shell.getByRole('textbox', { name: 'Route' });
  await routeBox.fill('/api/auth/login');
  await routeBox.press('Enter');

  const idp = new URL(await location);
  await truing.context.unrouteAll({ behavior: 'ignoreErrors' });
  const redirectUri = idp.searchParams.get('redirect_uri') ?? '';
  expect(redirectUri).toMatch(new RegExp(`^${app}/`));
});

test("a service worker that takes control of the frame leaves Truing's runtime connected", async ({
  shell,
}) => {
  const app = appFrame(shell, 'main');
  await expect
    .poll(() =>
      app.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    )
    .toBeGreaterThan(0);
  await app.evaluate(() => navigator.serviceWorker.ready);

  await shell.getByRole('button', { name: 'Reload' }).click();
  await expect(frameStatus(shell, 'Desktop')).toBeVisible();

  // The worker really is in charge of the page now, and the frame still connected.
  await expect
    .poll(() =>
      appFrame(shell, 'main').evaluate(() =>
        navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js'),
      ),
    )
    .toBe(true);
});

for (const { preset, width, desktopNav } of [
  { preset: 'Phone', width: 390, desktopNav: false },
  { preset: 'Tablet', width: 768, desktopNav: true },
  { preset: 'Desktop', width: 1440, desktopNav: true },
]) {
  test(`the app's breakpoints respond at ${preset} (${width} px)`, async ({
    shell,
  }) => {
    await chooseViewport(shell, new RegExp(`^${preset}`));
    await expect(frameStatus(shell, preset)).toBeVisible();

    expect(await appFrame(shell, 'main').evaluate(() => innerWidth)).toBe(
      width,
    );
    // The page rendered, so a hidden link below means the layout, not a blank frame.
    await expect(frame(shell, preset).getByText('Welcome back')).toBeVisible();
    // The header's section links show from tablet up; phones get the compact header.
    const nav = frame(shell, preset).getByRole('link', {
      name: 'Recommendation',
    });
    if (desktopNav) {
      await expect(nav).toBeVisible();
      return;
    }
    await expect(nav).toBeHidden();
  });
}

test('on Turbopack, a picked Button shows its call site in the feature and its definition in the primitive', async ({
  shell,
}) => {
  await shell.getByRole('button', { name: 'Select', exact: true }).click();
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Sign in to your account' })
    .click();

  const inspector = shell.getByRole('region', { name: 'Selection' });
  await expect(inspector).toContainText('ActionButton · variant outline');
  await expect(inspector).toContainText(
    /Call sitetest\/fixture-app\/app\/real-app\/app-header\.tsx:\d+/,
  );
  await expect(inspector).toContainText(
    /Definitiontest\/fixture-app\/components\/ui\/action-button\.tsx:\d+/,
  );
  await expect(inspector).toContainText('gap-300 → spacing-300 · 8px');
});

test('a page that refuses to be framed still shows, and still streams', async ({
  shell,
}) => {
  const routeBox = shell.getByRole('textbox', { name: 'Route' });
  await routeBox.fill('/framed-off');
  await routeBox.press('Enter');

  const page = frame(shell, 'Desktop');
  // The first part shows while the second is still on its way: nothing buffered it.
  await expect(page.getByText('first part')).toBeVisible();
  await expect(page.getByText('second part')).toHaveCount(0);
  await expect(page.getByText('second part')).toBeVisible();
});
