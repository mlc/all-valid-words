import AWS from 'aws-sdk';
import memoize from 'lodash/memoize';
import randomNumber from 'random-number-csprng';
import rp from 'request-promise-native';
import { ungzip } from 'node-gzip';
import weightedRandomObject from 'weighted-random-object';

import langs from './langs';

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

const findPhrasing = text => {
  const snippet = / [^EeÈÉÊËèéêëĒēĔĕĖėĘęĚěƐȄȅȆȇȨȩɛεϵЄЕеєҽԐԑعᎬᗴᘍᘓᥱᴱᵉᵋḘḙḚḛẸẹẺẻẼẽₑℇ℮ℯℰⅇ∈ⒺⓔⲈⲉⴹ㋍㋎ꗋꜪꜫﻉＥｅ𝈡𝐄𝐞𝐸𝑒𝑬𝒆𝓔𝓮𝔈𝔢𝔼𝕖𝕰𝖊𝖤𝖾𝗘𝗲𝘌𝘦𝙀𝙚𝙴𝚎🄴]{30,490} /giu;
  const matches = text.match(snippet).map(m => {
    const str = m.trim();
    const len = str.length;
    return { str, weight: len * len };
  });
  if (matches.length === 0) {
    throw new Error("couldn't find valid phrasing");
  }
  const r = weightedRandomObject(matches);
  return r.str;
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

export const codeForLang = languages => {
  if (languages.length !== 1) {
    return undefined;
  }
  return langs[languages[0]];
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
  const snippet = findPhrasing(text);
  const lang = codeForLang(Language);
  const status = await post(snippet, lang);
  const newPost = {
    url: status.url,
    post: snippet,
    book: Title,
    bookId: Num,
    author: Author,
    lang,
  };
  console.log(newPost);
  return savePosts([newPost, ...oldPosts]);
};

const fun = (event, context, callback) => {
  doit().then(() => callback(null, { message: 'OK' }), e => callback(e));
};

export default fun;
