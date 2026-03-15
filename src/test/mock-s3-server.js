import http from 'node:http'
import { Buffer } from 'node:buffer'

async function readBodyBuffer(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function decodeKey(parts) {
  return parts.map((part) => decodeURIComponent(part)).join('/')
}

export async function startMockS3Server() {
  const objects = new Map()

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const pathParts = url.pathname.split('/').filter(Boolean)

    if (pathParts[0] === 'public') {
      const bucket = pathParts[1]
      const key = decodeKey(pathParts.slice(2))
      const object = objects.get(`${bucket}/${key}`)

      if (!object) {
        res.writeHead(404)
        res.end()
        return
      }

      res.writeHead(200, {
        'Content-Type': object.contentType,
        'Content-Length': String(object.buffer.length),
        'Cache-Control': 'no-store',
      })
      res.end(object.buffer)
      return
    }

    const bucket = pathParts[0]
    const key = decodeKey(pathParts.slice(1))
    if (!bucket || !key) {
      res.writeHead(404)
      res.end()
      return
    }

    const objectKey = `${bucket}/${key}`

    if (req.method === 'PUT') {
      const buffer = await readBodyBuffer(req)
      objects.set(objectKey, {
        buffer,
        contentType:
          typeof req.headers['content-type'] === 'string'
            ? req.headers['content-type']
            : 'application/octet-stream',
      })
      res.writeHead(200, {
        ETag: '"mock-etag"',
      })
      res.end()
      return
    }

    if (req.method === 'HEAD') {
      const object = objects.get(objectKey)
      if (!object) {
        res.writeHead(404)
        res.end()
        return
      }

      res.writeHead(200, {
        'Content-Type': object.contentType,
        'Content-Length': String(object.buffer.length),
      })
      res.end()
      return
    }

    if (req.method === 'GET') {
      const object = objects.get(objectKey)
      if (!object) {
        res.writeHead(404)
        res.end()
        return
      }

      res.writeHead(200, {
        'Content-Type': object.contentType,
        'Content-Length': String(object.buffer.length),
      })
      res.end(object.buffer)
      return
    }

    res.writeHead(405)
    res.end()
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()

  return {
    objects,
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    },
  }
}
