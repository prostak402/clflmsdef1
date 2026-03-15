import { createReadStream, createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

function createStorageError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

export function createLocalStorageAdapter({ apiPrefix, config, getOrigin }) {
  const rootDir = config.localRootDir

  function resolveObjectPath(objectKey) {
    const normalizedKey = String(objectKey || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')

    if (!normalizedKey) {
      throw createStorageError('objectKey is required', 'INVALID_OBJECT_KEY')
    }

    const resolvedPath = path.resolve(rootDir, normalizedKey)
    const relativePath = path.relative(rootDir, resolvedPath)
    if (
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath) ||
      normalizedKey.includes('..')
    ) {
      throw createStorageError(
        'objectKey must stay within the local storage root',
        'INVALID_OBJECT_KEY'
      )
    }

    return resolvedPath
  }

  async function ensureRootDir() {
    await fs.mkdir(rootDir, { recursive: true })
  }

  return {
    provider: 'local',
    supportsLocalUpload: true,
    supportsAssetRead: true,

    async createUploadSession({ contentType, objectKey, req, uploadId }) {
      await ensureRootDir()

      return {
        uploadUrl: `${getOrigin(req)}${apiPrefix}/uploads/${encodeURIComponent(uploadId)}`,
        expiresIn: config.uploadExpiresIn,
        requiredHeaders: {
          'Content-Type': contentType,
        },
        objectKey,
      }
    },

    async finalizeUploadedObject({ req, session, maxSizeBytes }) {
      await ensureRootDir()

      const targetPath = resolveObjectPath(session.objectKey)
      const tempPath = `${targetPath}.uploading`
      let totalBytes = 0

      try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true })

        await pipeline(
          req,
          new Transform({
            transform(chunk, encoding, callback) {
              totalBytes += chunk.length
              if (totalBytes > maxSizeBytes) {
                callback(
                  createStorageError('Uploaded asset exceeds size limit', 'PAYLOAD_TOO_LARGE')
                )
                return
              }

              callback(null, chunk)
            },
          }),
          createWriteStream(tempPath)
        )

        if (totalBytes === 0) {
          throw createStorageError('Upload body is empty', 'EMPTY_BODY')
        }

        await fs.rename(tempPath, targetPath)
        return {
          size: totalBytes,
        }
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => {})
        throw error
      }
    },

    async assertObjectExists({ session }) {
      try {
        await fs.access(resolveObjectPath(session.objectKey))
        return true
      } catch {
        return false
      }
    },

    getPublicAssetUrl({ req, session }) {
      return `${getOrigin(req)}${apiPrefix}/assets/${encodeURIComponent(session.id)}`
    },

    async sendAsset({ res, session }) {
      const objectPath = resolveObjectPath(session.objectKey)
      const stat = await fs.stat(objectPath).catch(() => null)

      if (!stat?.isFile()) {
        return false
      }

      res.writeHead(200, {
        'Content-Type': session.contentType || 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-store',
      })

      await pipeline(createReadStream(objectPath), res)
      return true
    },
  }
}
