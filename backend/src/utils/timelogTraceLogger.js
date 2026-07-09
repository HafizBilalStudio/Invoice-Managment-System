const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../../logs');

function ensureLogsDir() {
  fs.mkdirSync(logsDir, { recursive: true });
}

function sanitizeRequestId(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createTimelogTraceLogger(requestId) {
  ensureLogsDir();

  const safeRequestId = sanitizeRequestId(requestId);
  const fileName = `timelog-sync-${safeRequestId}.log`;
  const filePath = path.join(logsDir, fileName);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  function write(event, payload = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      requestId,
      event,
      ...payload
    };

    stream.write(`${JSON.stringify(entry)}\n`);
  }

  function close() {
    stream.end();
  }

  return {
    fileName,
    filePath,
    write,
    close
  };
}

module.exports = {
  createTimelogTraceLogger
};
