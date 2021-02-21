import { S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ apiVersion: '2006-03-01', region: 'us-east-1' });
export default s3;
