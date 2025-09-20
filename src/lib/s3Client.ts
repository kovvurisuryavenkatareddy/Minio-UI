import { S3Client } from "@aws-sdk/client-s3";

const endpointUrl = import.meta.env.VITE_MINIO_ENDPOINT;
const accessKeyId = import.meta.env.VITE_MINIO_ACCESS_KEY;
const secretAccessKey = import.meta.env.VITE_MINIO_SECRET_KEY;

let s3Client: S3Client | null = null;
let connectionError: string | null = null;

if (!endpointUrl || !accessKeyId || !secretAccessKey) {
  connectionError =
    "MinIO environment variables are not set. Please create a .env.local file with your credentials and rebuild the app.";
} else {
  try {
    // Ensure the endpoint has a protocol, defaulting to http
    const endpoint = endpointUrl.startsWith("http") ? endpointUrl : `http://${endpointUrl}`;
    
    // Validate the URL before creating the client
    new URL(endpoint);

    s3Client = new S3Client({
      endpoint: endpoint,
      region: "us-east-1", // This is required, 'us-east-1' is a common default
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true, // This is important for MinIO
    });
  } catch (e) {
    connectionError = `Invalid MinIO endpoint URL provided: "${endpointUrl}". Please check your .env.local file and ensure it's a valid URL (e.g., http://localhost:9000).`;
    console.error(e);
  }
}

export { s3Client, connectionError };