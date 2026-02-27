const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data || '{}') }); }
        catch (e) { resolve({ status: res.statusCode, headers: res.headers, bodyRaw: data }); }
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    // Login
    const login = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'admin@local.test', password: 'ChangeMe123!' });
    console.log('LOGIN', login.status);
    const token = login.body && login.body.token;
    if (!token) { console.error('No token'); return; }

    // Get users
    const users = await request({ hostname: 'localhost', port: 5000, path: '/api/users', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    console.log('USERS', users.status);
    const list = users.body && users.body.data;
    if (!Array.isArray(list) || list.length === 0) { console.error('No users to delete'); return; }

    // choose first non-admin
    const target = list.find(u => u.role !== 'admin') || list[0];
    console.log('Deleting', target._id, target.email, target.role);

    const del = await request({ hostname: 'localhost', port: 5000, path: `/api/users/${target._id}`, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log('DELETE', del.status, del.body || del.bodyRaw);
  } catch (err) {
    console.error('Err', err);
  }
}

run();
