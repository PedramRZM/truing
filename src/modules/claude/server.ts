import { defineServer } from '../../module';

import { createChat } from './chat';
import claude from './module';

const OK = { ok: true };

export default defineServer(claude, (ctx) => {
  const chat = createChat({
    root: ctx.root,
    config: ctx.config,
    publish: {
      chat: (value) => ctx.publish('chat', value),
      live: (value) => ctx.publish('live', value),
    },
    exclusive: ctx.exclusive,
    screenshot: ctx.screenshot,
    frames: ctx.frames,
    log: ctx.log,
    tools: ctx.tools,
  });
  chat.publishInitial();

  return {
    ops: {
      status: async () => {
        await chat.status();
        return OK;
      },
      send: (input) => {
        chat.send(input);
        return OK;
      },
      newChat: () => {
        chat.newChat();
        return OK;
      },
      resume: async ({ id }) => {
        await chat.resume(id);
        return OK;
      },
      stop: () => {
        chat.stop();
        return OK;
      },
      unqueue: ({ id }) => {
        chat.unqueue(id);
        return OK;
      },
      answer: ({ id, allow }) => {
        chat.answer(id, allow);
        return OK;
      },
      keep: ({ id }) => {
        chat.keep(id);
        return OK;
      },
      undo: async ({ id }) => {
        await chat.undo(id);
        return OK;
      },
    },
    onClose: () => chat.close(),
  };
});
