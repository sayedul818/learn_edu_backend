const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, bodyRaw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    console.log('Logging in as admin@local.test...');
    const loginRes = await request(loginOptions, { email: 'admin@local.test', password: 'ChangeMe123!' });
    console.log('LOGIN STATUS', loginRes.status);
    console.log('LOGIN BODY', loginRes.body || loginRes.bodyRaw);

    if (!loginRes.body || !loginRes.body.token) {
      console.error('No token received; aborting users fetch.');
      return;
    }

    const token = loginRes.body.token;
    const usersOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };

    console.log('Fetching /api/users with token...');
    const usersRes = await request(usersOptions);
    console.log('USERS STATUS', usersRes.status);
    console.log('USERS BODY', usersRes.body || usersRes.bodyRaw);
  } catch (err) {
    console.error('Error during test:', err && err.message ? err.message : err);
  }
}

run();
