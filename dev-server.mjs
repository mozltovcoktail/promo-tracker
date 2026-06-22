import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5194
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
}

const clients = new Set()

const INJECT = `<script>
(function(){
  const es = new EventSource('/__reload');
  es.onmessage = () => location.reload();
})();
</script>`

const server = http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write('\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url)
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return }

  const ext = path.extname(filePath)
  const mime = MIME[ext] || 'application/octet-stream'
  let body = fs.readFileSync(filePath)

  if (ext === '.html') {
    body = Buffer.from(body.toString().replace('</body>', INJECT + '</body>'))
  }

  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' })
  res.end(body)
})

fs.watch(DIR, { recursive: true }, (_, filename) => {
  if (!filename || filename.includes('node_modules') || filename.startsWith('.')) return
  clients.forEach(res => res.write('data: reload\n\n'))
})

server.listen(PORT, () => console.log(`http://localhost:${PORT}`))
