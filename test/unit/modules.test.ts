import path from 'node:path';

import { expect, it } from 'vitest';

import { loadModules, ModuleConfigError } from '../../src/module-loader';

import { moduleTs, PACKAGE_ROOT, writeModules } from './temp-modules';

it('loads a built-in module by name and a project module by path, in config order', async () => {
  const modules = await loadModules(PACKAGE_ROOT, {
    modules: ['./examples/element-count', 'selection'],
  });

  expect(modules.map((loaded) => loaded.spec.id)).toEqual([
    'element-count',
    'selection',
  ]);
  const [count, selection] = modules;
  expect(count?.server).toBe(
    path.join(PACKAGE_ROOT, 'examples/element-count/server.ts'),
  );
  expect(selection?.probe).toMatch(/src\/modules\/selection\/probe\.ts$/);
  expect(selection?.server).toMatch(/src\/modules\/selection\/server\.ts$/);
});

it('loads nothing when the config lists no modules', async () => {
  expect(await loadModules(PACKAGE_ROOT, {})).toEqual([]);
});

it('refuses a built-in name that does not exist', async () => {
  await expect(
    loadModules(PACKAGE_ROOT, { modules: ['no-such-module'] }),
  ).rejects.toThrow(/no-such-module.*has no module\.ts/);
});

it('refuses an entry that is neither a name nor a path', async () => {
  await expect(
    loadModules(PACKAGE_ROOT, { modules: ['Not A Name'] }),
  ).rejects.toThrow(ModuleConfigError);
});

it('refuses a declared part without its file', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['left'] } }`,
      ),
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    'Module "a" declares a panel but has no panel.tsx.',
  );
});

it('refuses a part file the module does not declare', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(`{ id: 'a', title: 'A' }`),
      'probe.ts': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /has probe\.ts but its module\.ts declares no probe/,
  );
});

it('refuses Claude tools without a server part to handle them', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', claude: { tools: { do_it: { description: 'Does it.', input: z.object({}) } } } }`,
      ),
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /declares a server but has no server\.ts/,
  );
});

it('refuses two modules with the same id', async () => {
  const root = writeModules({
    a: { 'module.ts': moduleTs(`{ id: 'same', title: 'A' }`) },
    b: { 'module.ts': moduleTs(`{ id: 'same', title: 'B' }`) },
  });
  await expect(loadModules(root, { modules: ['./a', './b'] })).rejects.toThrow(
    'Two modules have the id "same".',
  );
});

it('refuses two modules that add the same tool', async () => {
  const tool = `claude: { tools: { do_it: { description: 'Does it.', input: z.object({}) } } }`;
  const server = 'export default {};';
  const root = writeModules({
    a: {
      'module.ts': moduleTs(`{ id: 'a', title: 'A', ${tool} }`),
      'server.ts': server,
    },
    b: {
      'module.ts': moduleTs(`{ id: 'b', title: 'B', ${tool} }`),
      'server.ts': server,
    },
  });
  await expect(loadModules(root, { modules: ['./a', './b'] })).rejects.toThrow(
    'Modules "a" and "b" both add the tool "do_it".',
  );
});

it('refuses a declaration that is not schemas', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', probe: { reports: { count: { elements: 'number' } } } }`,
      ),
      'probe.ts': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /probe\.reports\.count is not a zod schema/,
  );
});

it('reads which tab a left section asks for, and leaves it unset by default', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['left'], tab: 'theme' } }`,
      ),
      'panel.tsx': 'export default {};',
    },
    b: {
      'module.ts': moduleTs(
        `{ id: 'b', title: 'B', panel: { docks: ['left'] } }`,
      ),
      'panel.tsx': 'export default {};',
    },
  });
  const [a, b] = await loadModules(root, { modules: ['./a', './b'] });
  expect(a?.spec.panel?.tab).toBe('theme');
  expect(b?.spec.panel?.tab).toBeUndefined();
});

it('refuses a tab that is not one of the left panel’s', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['left'], tab: 'tokens' } }`,
      ),
      'panel.tsx': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /panel\.tab/,
  );
});

it('refuses a tab on a module with no left section', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['right'], tab: 'theme' } }`,
      ),
      'panel.tsx': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /panel names a tab but no left section/,
  );
});

it('refuses the foot on a module with no right section', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['left'], foot: true } }`,
      ),
      'panel.tsx': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /panel asks for the foot but has no right section/,
  );
});

it('refuses a panel that names a dock twice', async () => {
  const root = writeModules({
    a: {
      'module.ts': moduleTs(
        `{ id: 'a', title: 'A', panel: { docks: ['left', 'left'] } }`,
      ),
      'panel.tsx': 'export default {};',
    },
  });
  await expect(loadModules(root, { modules: ['./a'] })).rejects.toThrow(
    /panel\.docks names a dock twice/,
  );
});
