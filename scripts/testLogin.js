const http = require('http');

const data = JSON.stringify({ email: 'admin@local.test', password: 'ChangeMe123!' });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('HEADERS', res.headers);
    try {
      console.log('BODY', JSON.parse(body));
    } catch (e) {
      console.log('BODY_RAW', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error', e.message);
});

req.write(data);
req.end();
