// Each value a person can look at, change or have read again (TRU-10.3). On its own,
// as the panel's schemas and the setup server both need it.
export const SETTING_FIELDS = [
  'name',
  'framework',
  'devCommand',
  'port',
  'startRoute',
  'appDir',
  'source',
  'primitives',
  'tokens',
  'tailwindMerge',
  'writable',
  'checks',
  'dropEnv',
] as const;
export type SettingField = (typeof SETTING_FIELDS)[number];

type Fielded = Record<Exclude<SettingField, 'writable'>, unknown> & {
  writableInclude: readonly string[];
  writableExclude: readonly string[];
};

/** The values two drafts disagree on: what a person corrected on the review screen. */
export function changedFields(before: Fielded, after: Fielded): SettingField[] {
  const valueOf = (draft: Fielded, field: SettingField): unknown =>
    field === 'writable'
      ? [draft.writableInclude, draft.writableExclude]
      : draft[field];
  return SETTING_FIELDS.filter(
    (field) =>
      JSON.stringify(valueOf(before, field)) !==
      JSON.stringify(valueOf(after, field)),
  );
}
