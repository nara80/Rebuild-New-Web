import http from 'node:http';
http.get('http://127.0.0.1:8799/', (res) => {
  let b = '';
  res.on('data', (c) => (b += c));
  res.on('end', () => {
    const m = b.match(/<script id="runtime-analytics-config">(.*?)<\/script>/);
    console.log('injected config:', m ? m[1] : 'ABSENT');
  });
});
