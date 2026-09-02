import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const client =
  env.s3Endpoint && env.s3AccessKey && env.s3SecretKey
    ? new S3Client({
        endpoint: env.s3Endpoint,
        region: process.env.S3_REGION || "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey },
      })
    : null;

export async function createImageUploadUrl({ key, contentType, expiresIn = 900 }) {
  if (!client) return null;
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function checkImageStorage() {
  if (!client) return !env.s3Endpoint && !env.s3PublicUrl;
  await client.send(new HeadBucketCommand({ Bucket: env.s3Bucket }));
  return true;
}
