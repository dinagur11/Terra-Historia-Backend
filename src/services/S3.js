import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

export const s3 = new S3Client({ region: process.env.AWS_REGION })

export const getJsonFromS3 = async (bucket, key) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  })
  const response = await s3.send(command)
  const body = await response.Body.transformToString()
  return JSON.parse(body)
}