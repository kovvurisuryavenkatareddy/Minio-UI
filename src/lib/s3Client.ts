import { S3Client } from "@aws-sdk/client-s3";

const endpoint = import.meta.env.VITE_MINIO_ENDPOINT;
const accessKeyId = import.meta.env.VITE_MINIO_ACCESS_KEY;
const secretAccessKey = import.meta.env.VITE_MINIO_SECRET_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "MinIO environment variables are not set. Please create a .env.local file."
  );
}

export const s3Client = new S3Client({
  endpoint: endpoint,
  region: "us-east-1", // This is required, 'us-east-1' is a common default
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
  forcePathStyle: true, // This is important for MinIO
});