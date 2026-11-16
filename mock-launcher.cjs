'use strict';

const { EventEmitter } = require('node:events');
const childProcess = require('node:child_process');

childProcess.spawn = (command, args) => {
  if (!['rundll32.exe', 'open', 'xdg-open'].includes(command)) {
    throw new Error(`Unexpected browser launcher: ${command}`);
  }
  if (!args.length) {
    throw new Error('Browser launcher did not receive a target.');
  }

  const child = new EventEmitter();
  child.unref = () => {};
  process.nextTick(() => child.emit('spawn'));
  return child;
};
