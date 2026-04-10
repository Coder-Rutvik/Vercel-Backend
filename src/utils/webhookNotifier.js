const http = require('http');
const https = require('https');

const sendWebhook = ({ url, payload, timeoutMs = 5000 }) =>
  new Promise((resolve) => {
    if (!url) {
      resolve({ ok: false, statusCode: null, error: 'Missing webhook URL.' });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      resolve({ ok: false, statusCode: null, error: `Invalid webhook URL: ${error.message}` });
      return;
    }

    const body = JSON.stringify(payload || {});
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: timeoutMs
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          const responseBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            statusCode,
            responseBody
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Webhook request timed out.'));
    });

    req.on('error', (error) => {
      resolve({ ok: false, statusCode: null, error: error.message });
    });

    req.write(body);
    req.end();
  });

module.exports = {
  sendWebhook
};
