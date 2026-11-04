import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { Marks } from '../../shell/controls/marks';

import {
  readWord,
  type WordControl,
  wordChange,
  wordValue,
} from './effect-classes';
import { stagedFor } from './layout-classes';
import { type Editor, FromMarks, stageWord } from './layout-sections';

/** One word among a few, named beside it: each shows on the page while it's pointed at (TRU-4.5). */
export function WordRow({
  editor,
  control,
  unknown,
}: {
  editor: Editor;
  control: WordControl;
  /** What it reads when the page's value is none of the words. */
  unknown?: string;
}) {
  const { property, name, family, words, reads } = control;
  const staged = stagedFor(
    editor.changes,
    editor.picked,
    editor.width,
    property,
  )?.after[0]?.value;
  const now = readWord(
    control,
    editor.classes,
    editor.own,
    editor.width,
    staged,
  );
  const value = now.word ? now.text : (unknown ?? now.text);
  return (
    <div className="word-row">
      <span className="word-label">{name}</span>
      <ChoiceMenu
        name={name}
        value={value}
        choices={words.map((choice) => ({
          label: choice.label,
          checked: choice === now.word,
          onPreview: (on) =>
            editor.preview(
              on === null
                ? null
                : wordChange(control, choice, editor.classes, editor.target),
            ),
          onChange: () => {
            if (choice === now.word) return;
            stageWord(editor, {
              property,
              name,
              family,
              className: choice.className,
              change: wordChange(
                control,
                choice,
                editor.classes,
                editor.target,
              ),
              from: value,
              to: choice.label,
              css: wordValue(choice),
              fromCss: now.word
                ? wordValue(now.word)
                : (editor.own[reads ?? property] ?? ''),
              intent: `Set ${name.toLowerCase()} to ${choice.label.toLowerCase()}`,
              clearWith: choice.clearWith,
            });
          },
        }))}
      />
      {now.off ? <Marks reading={{ token: null, off: true }} /> : null}
      <FromMarks editor={editor} families={[family]} />
    </div>
  );
}
