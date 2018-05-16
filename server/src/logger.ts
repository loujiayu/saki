import chalk from 'chalk';

import emoji from './utils/emoji';

class Logger {
  lines: number;
  logLevel: number;
  constructor() {
    this.lines = 0;
    this.setOptions();
  }

  setOptions() {
    this.logLevel = 3;
  }

  write(message: string) {
    console.log(message);
  }

  log(message: string) {
    this.write(message);
  }

  warn(message: string) {
    this.write(chalk.yellow(`${emoji.warning}  ${message}`));
  }

  error(err: string) {
    this.write(chalk.red(`${emoji.error}  ${err}`));
  }
}