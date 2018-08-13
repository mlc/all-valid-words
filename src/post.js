import AWS from 'aws-sdk';
import memoize from 'lodash/memoize';
import randomNumber from 'random-number-csprng';
import { ungzip } from 'node-gzip';

const s3 = new AWS.S3();

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';

const metadata = memoize(() =>
  s3
    .getObject({ Bucket: bucket, Key: metadataFile })
    .promise()
    .then(({ Body }) => ungzip(Body))
    .then(data => JSON.parse(data))
    .then(data =>
      data.filter(
        ({ 'Copyright Status': [cs] }) =>
          cs === 'Not copyrighted in the United States.' ||
          cs === 'Public domain in the USA.'
      )
    )
);

const doit = async () => {
  const gutenberg = await metadata();
  const file = gutenberg[await randomNumber(0, gutenberg.length - 1)];
  const book = await s3
    .getObject({ Bucket: bucket, Key: file['gd-path'] })
    .promise()
    .then(({ Body }) => Body.toString());
};

const fun = (event, context, callback) => {
  doit().then(() => callback(null, { message: 'OK' }), e => callback(e));
};

export default fun;
