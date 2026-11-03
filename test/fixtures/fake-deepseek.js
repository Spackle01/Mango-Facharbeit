'use strict';
// Test-Double für die DeepSeek-API: /models und /chat/completions (Stream, Werkzeugaufrufe).
const http = require('http');

function start({ key = 'sk-test-0123456789abcdef', skript } = {}) {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Authentication Fails' } })); return; }
      if (req.url === '/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] })); return; }
      if (req.url === '/chat/completions') {
        const j = JSON.parse(body);
        calls.push(j);
        const schritt = skript(j, calls.length);
        if (schritt && schritt.status) { res.writeHead(schritt.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: schritt.meldung || 'Fehler' } })); return; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const send = (delta, finish = null) => res.write(`data: ${JSON.stringify({ id: 'x', model: 'deepseek-flash-test', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
        if (schritt.reasoning) send({ reasoning_content: schritt.reasoning });
        if (schritt.text) for (const stueck of schritt.text.match(/[\s\S]{1,9}/g)) send({ content: stueck });
        (schritt.tools || []).forEach((t, i) => {
          const args = JSON.stringify(t.args);
          send({ tool_calls: [{ index: i, id: `call_${calls.length}_${i}`, type: 'function', function: { name: t.name, arguments: '' } }] });
          for (const stueck of args.match(/[\s\S]{1,7}/g)) send({ tool_calls: [{ index: i, function: { arguments: stueck } }] });
        });
        send({}, schritt.tools && schritt.tools.length ? 'tool_calls' : 'stop');
        res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } })}\n\n`);
        res.end('data: [DONE]\n\n');
        return;
      }
      res.writeHead(404); res.end('{}');
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, calls, url: `http://127.0.0.1:${srv.address().port}`, key, close: () => srv.close() })));
}

module.exports = { start };
