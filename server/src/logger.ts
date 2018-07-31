import chalk from 'chalk';

import emoji from './utils/emoji';

export class Logger {
  lines: number;
  isDev: boolean;
  
  constructor() {
    this.lines = 0;
    this.setOptions();
  }

  setOptions() {
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  write(message: string) {
    if (this.isDev) {
      console.log(message);
    }
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

const logger = new Logger();

export default logger;
