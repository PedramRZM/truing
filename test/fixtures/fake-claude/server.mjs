// A dev server that stands in for a project's own: the port comes from argv.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? process.env.PORT ?? 3199);
createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<!doctype html><title>app</title><h1>The app</h1>');
}).listen(port, () => {
  console.log(`ready on http://localhost:${port}`);
});
