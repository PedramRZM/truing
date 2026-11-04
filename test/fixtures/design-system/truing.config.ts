// A project with a real design system: the config test and the token tests
// read it. Explicit on purpose: most projects never have this file.
import type { TruingConfig } from '../../../src/config';

export default {
  name: 'design-system',
  app: {
    devCommand: 'pnpm dev',
    port: 3000,
    startRoute: '/',
  },
  server: {
    port: 4100,
  },
  primitives: 'src/components/ui/',
  source: 'src',
  tokens: 'src/app/globals.css',
  tailwindMerge: 'src/lib/tailwind-merge-tokens.json',
  writable: {
    include: ['src/**/*.tsx', 'src/app/globals.css', 'src/stories/**'],
    exclude: [
      'src/server/**',
      'src/app/**/route.ts',
      'src/app/actions/**',
      'src/**/*.test.tsx',
      'src/**/*.spec.tsx',
      'src/**/__tests__/**',
    ],
  },
  branch: {
    pattern: 'design/{feature}',
  },
  modules: ['selection', 'changes', 'claude-config', 'claude'],
  claude: {
    dropEnv: ['CLAUDE_PERSONAL_HOOKS'],
    shell: {
      allow: ['pnpm typecheck', 'pnpm run typecheck', 'pnpm exec eslint *'],
      ask: ['* --fix', '* --fix *', '* --output-file *', '* -o *'],
    },
  },
} satisfies TruingConfig;
