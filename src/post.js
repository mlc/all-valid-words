import AWS from 'aws-sdk';
import memoize from 'lodash/memoize';
import iso639 from 'iso-639-2';
import randomNumber from 'random-number-csprng';
import rp from 'request-promise-native';
import { ungzip } from 'node-gzip';

const s3 = new AWS.S3();

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';
const pubbucket = 'words.oulipo.link';
const postsFile = 'posts.json';

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

const getOldPosts = () =>
  s3
    .getObject({ Bucket: pubbucket, Key: postsFile })
    .promise()
    .then(({ Body }) => JSON.parse(Body))
    .catch(e => {
      if (e.code === 'NoSuchKey') {
        return [];
      } else {
        throw e;
      }
    });

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
      visibility: 'public',
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

const savePosts = posts =>
  s3
    .putObject({
      Body: JSON.stringify(posts),
      Bucket: pubbucket,
      Key: postsFile,
      ContentType: 'application/json',
      CacheControl: 'public',
      Expires: new Date(Number(new Date()) + 4 * 3600 * 1000),
    })
    .promise();

const doit = async () => {
  const [{ text, Author, Language, Num, Title }, oldPosts] = await Promise.all([
    findRandomBook(),
    getOldPosts(),
  ]);
  const snippet = await findPhrasing(text);
  const status = await post(snippet, codeForLang(Language));
  const newPost = {
    url: status.url,
    post: snippet,
    book: Title,
    bookId: Num,
    author: Author,
  };
  console.log(newPost);
  return savePosts([newPost, ...oldPosts]);
};

const fun = (event, context, callback) => {
  doit().then(() => callback(null, { message: 'OK' }), e => callback(e));
};

export default fun;
