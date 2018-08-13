import AWS from 'aws-sdk';
import memoize from 'lodash/memoize';
import iso639 from 'iso-639-2';
import randomNumber from 'random-number-csprng';
import rp from 'request-promise-native';
import { ungzip } from 'node-gzip';

const s3 = new AWS.S3();

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';

const spaces = /[\p{White_Space}]+/gu;
const maxIters = 50;

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

export const findRandomBook = async () => {
  const gutenberg = await metadata();
  const file = gutenberg[await randomNumber(0, gutenberg.length - 1)];
  const text = await s3
    .getObject({ Bucket: bucket, Key: file['gd-path'] })
    .promise()
    .then(({ Body }) => Body.toString().replace(spaces, ' '));
  return { ...file, text };
};

const findPhrasing = async text => {
  const snippet = / ([^EeÈÉÊËèéêëĒēĔĕĖėĘęĚěƐȄȅȆȇȨȩɛεϵЄЕеєҽԐԑعᎬᗴᘍᘓᥱᴱᵉᵋḘḙḚḛẸẹẺẻẼẽₑℇ℮ℯℰⅇ∈ⒺⓔⲈⲉⴹ㋍㋎ꗋꜪꜫﻉＥｅ𝈡𝐄𝐞𝐸𝑒𝑬𝒆𝓔𝓮𝔈𝔢𝔼𝕖𝕰𝖊𝖤𝖾𝗘𝗲𝘌𝘦𝙀𝙚𝙴𝚎🄴]{30,}) /giu;
  let i;
  for (i = 0; i < maxIters; ++i) {
    const startPos = await randomNumber(0, text.length - 1);
    snippet.lastIndex = startPos;
    const match = snippet.exec(text);
    if (match) {
      return match[1];
    }
  }
  throw new Error("couldn't find valid phrasing");
};

const post = (status, language) =>
  rp({
    uri: 'https://oulipo.social/api/v1/statuses',
    method: 'POST',
    json: true,
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
    body: {
      status,
      visibility: 'direct',
      language,
    },
  });

export const codeForLang = lang => {
  const l = iso639.find(({ name }) => name === lang);
  if (l && l.iso6392B) {
    return l.iso6392B;
  }
  return undefined;
};

const doit = async () => {
  const { text, Language } = await findRandomBook();
  const snippet = await findPhrasing(text);
  console.log(await post(snippet, codeForLang(Language)));
};

const fun = (event, context, callback) => {
  doit().then(() => callback(null, { message: 'OK' }), e => callback(e));
};

export default fun;
