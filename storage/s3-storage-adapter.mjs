import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function encodeObjectKey(objectKey) {
  return String(objectKey)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function joinUrl(baseUrl, suffix) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(suffix).replace(/^\/+/, '')}`
}

function createS3Client(config) {
  const clientConfig = {
    region: config.s3.region,
    forcePathStyle: config.s3.forcePathStyle,
  }

  if (config.s3.endpoint) {
    clientConfig.endpoint = config.s3.endpoint
  }

  if (config.s3.accessKeyId && config.s3.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      ...(config.s3.sessionToken ? { sessionToken: config.s3.sessionToken } : {}),
    }
  }

  return new S3Client(clientConfig)
}

function buildPublicAssetUrl(config, objectKey) {
  const encodedKey = encodeObjectKey(objectKey)

  if (config.s3.publicBaseUrl) {
    return joinUrl(config.s3.publicBaseUrl, encodedKey)
  }

  if (config.s3.endpoint) {
    if (config.s3.forcePathStyle) {
      return joinUrl(config.s3.endpoint, `${config.s3.bucket}/${encodedKey}`)
    }

    const endpointUrl = new URL(config.s3.endpoint)
    endpointUrl.hostname = `${config.s3.bucket}.${endpointUrl.hostname}`
    endpointUrl.pathname = `/${encodedKey}`
    endpointUrl.search = ''
    endpointUrl.hash = ''
    return endpointUrl.toString()
  }

  return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${encodedKey}`
}

export function createS3StorageAdapter({ config }) {
  if (!config.s3.bucket) {
    throw new Error('S3_BUCKET is required when STORAGE_PROVIDER=s3')
  }

  const client = createS3Client(config)

  return {
    provider: 's3',
    supportsLocalUpload: false,
    supportsAssetRead: false,

    async createUploadSession({ contentType, objectKey }) {
      const command = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: objectKey,
        ContentType: contentType,
      })

      return {
        uploadUrl: await getSignedUrl(client, command, {
          expiresIn: config.uploadExpiresIn,
        }),
        expiresIn: config.uploadExpiresIn,
        requiredHeaders: {
          'Content-Type': contentType,
        },
        objectKey,
      }
    },

    async assertObjectExists({ session }) {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: config.s3.bucket,
            Key: session.objectKey,
          })
        )
        return true
      } catch (error) {
        const statusCode = Number(error?.$metadata?.httpStatusCode)
        const name = typeof error?.name === 'string' ? error.name : ''
        if (statusCode === 404 || name === 'NotFound' || name === 'NoSuchKey') {
          return false
        }

        throw error
      }
    },

    getPublicAssetUrl({ session }) {
      return buildPublicAssetUrl(config, session.objectKey)
    },
  }
}
