import AWS from 'aws-sdk';

const s3 = new AWS.S3({ apiVersion: '2006-03-01', region: 'us-east-1' });
export default s3;
