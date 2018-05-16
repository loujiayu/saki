const supportsEmoji =
  process.platform !== 'win32' || process.env.TERM === 'xterm-256color';

const emoji = {
  process: supportsEmoji ? '⏳' : '∞',
  success: supportsEmoji ? '✨' : '√',
  error: supportsEmoji ? '🚨' : '×',
  warning: supportsEmoji ? '⚠️' : '‼'
};

export default emoji;