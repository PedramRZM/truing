import { defineServer } from '../../module';
import type { SettingField } from '../../setup/setting-fields';
import {
  applyLive,
  readOneValue,
  type ReadValue,
  readSettings,
  saveSettings,
} from '../../setup/settings';

import settings from './module';

export default defineServer(settings, (ctx) => {
  /** Since the last save: what "Read again" answered, by value. */
  const read = new Map<SettingField, ReadValue>();

  return {
    ops: {
      read: () => readSettings(ctx.root),
      save: async ({ values, confirmedCommand }) => {
        const saved = await saveSettings({
          root: ctx.root,
          values,
          confirmedCommand,
          read,
        });
        read.clear();
        applyLive(ctx.config, saved.config);
        return { reopen: saved.reopen, tokensDropped: saved.tokensDropped };
      },
      readAgain: async ({ field }) => {
        const answer = await readOneValue(ctx.root, field, {
          dropEnv: ctx.config.claude?.dropEnv ?? [],
        });
        read.set(field, answer);
        return answer;
      },
    },
  };
});
