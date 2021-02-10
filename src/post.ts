import { convert, ZonedDateTime, ZoneId } from '@js-joda/core';
import memoize from 'lodash/memoize';
import { promisify } from 'util';
import weightedRandomObject from 'weighted-random-object';
import { blacklisted as blocklisted } from 'wordfilter';
import * as zlib from 'zlib';

import { getFileName } from './date';
import fixCache from './fix-cache';
import { codeForLang } from './langs';
import { MastoVisibility, post } from './mastodon';
import { pRandomBytes, randomNumber } from './random-number';
import s3 from './s3';

const gunzip = promisify<zlib.InputType, Buffer>(zlib.gunzip);

export interface GutenbergBook {
  Author: Array<string>;
  'Author Birth': Array<string>;
  'Author Given': Array<string>;
  'Author Death': Array<string>;
  'Author Surname': Array<string>;
  'Copyright Status': Array<string>;
  Language: Array<string>;
  'LoC Class': Array<string>;
  Num: string;
  Subject: Array<string>;
  Title: Array<string>;
  charset: string;
  'gd-num-padded': string;
  'gd-path': string;
  href: string;
}

export interface GutenbergBookWithText extends GutenbergBook {
  text: string;
}

interface PostData {
  url: string | null;
  post: string;
  book: Array<string>;
  bookId: string;
  author: Array<string>;
  lang?: string;
  ts?: string;
}

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';
const pubbucket = 'words.oulipo.link';

const spaces = /[\p{White_Space}]+/gu;
const PUBLIC_ODDS = 6;

export const metadata: () => Promise<Array<GutenbergBook>> = memoize(() =>
  s3
    .getObject({ Bucket: bucket, Key: metadataFile })
    .promise()
    .then(({ Body }) => gunzip(Body as Buffer))
    .then((data) => JSON.parse(data.toString()) as Array<GutenbergBook>)
    .then((data) =>
      data.filter(
        ({ 'Copyright Status': [cs] }) =>
          cs === 'Not copyrighted in the United States.' ||
          cs === 'Public domain in the USA.'
      )
    )
);

const getOldPosts = (time: string): Promise<ReadonlyArray<PostData>> =>
  s3
    .getObject({ Bucket: pubbucket, Key: getFileName(time) })
    .promise()
    .then(({ Body }) => JSON.parse((Body as Buffer).toString()))
    .catch((e) => {
      if ('code' in e && e.code === 'NoSuchKey') {
        return fixCache(pubbucket, time)
          .catch(console.warn)
          .then(() => []);
      }
      throw e;
    });

export const findBook = async (
  file: GutenbergBook
): Promise<GutenbergBookWithText> => {
  const text = await s3
    .getObject({ Bucket: bucket, Key: `${file['gd-path']}.gz` })
    .promise()
    .then(({ Body }) => gunzip(Body as Buffer))
    .then((book) => book.toString().replace(spaces, ' '));
  return { ...file, text };
};

export const findRandomBook = async (): Promise<GutenbergBookWithText> => {
  const gutenberg = await metadata();
  const file = gutenberg[await randomNumber(gutenberg.length - 1)];
  return findBook(file);
};

const allValidSymbols = / [^EeÈÉÊËèéêëĒēĔĕĖėĘęĚěƐȄȅȆȇȨȩɛεϵЄЕеєҽԐԑعᎬᗴᘍᘓᥱᴱᵉᵋḘḙḚḛẸẹẺẻẼẽₑℇ℮ℯℰⅇ∈ⒺⓔⲈⲉⴹ㋍㋎ꗋꜪꜫﻉＥｅ𝈡𝐄𝐞𝐸𝑒𝑬𝒆𝓔𝓮𝔈𝔢𝔼𝕖𝕰𝖊𝖤𝖾𝗘𝗲𝘌𝘦𝙀𝙚𝙴𝚎🄴æœ]{30,490} /giu;

export const findPhrasings = (text: string): ReadonlyArray<string> =>
  text.match(allValidSymbols) || [];

const findPhrasing = (text: string): string => {
  const matches = findPhrasings(text)
    .filter((phrasing) => !blocklisted(phrasing))
    .map((m) => {
      const str = m.trim();
      const len = str.length;
      return { str, weight: len * len };
    });
  if (matches.length === 0) {
    throw new Error("couldn't find valid phrasing");
  }
  return weightedRandomObject(matches).str;
};

const makeNonce = (): Promise<string> =>
  pRandomBytes(32).then((buf) => buf.toString('hex'));

const hanzi = /\p{Script=Han}/u;
const cyrl = /\p{Script=Cyrillic}/u;
const hangul = /\p{Script=Hangul}/u;
const greek = /\p{Script=Greek}/u;

const warning = (text: string): string | undefined => {
  if (hanzi.test(text)) {
    return 'hanzi';
  } else if (cyrl.test(text)) {
    return 'cyrillic';
  } else if (hangul.test(text)) {
    return 'hangul';
  } else if (greek.test(text)) {
    return 'doric';
  } else {
    return undefined;
  }
};

const pickVisibility = async (): Promise<MastoVisibility> => {
  const n = await randomNumber(PUBLIC_ODDS - 1);
  return n === 0 ? 'public' : 'unlisted';
};

const savePosts = (time: string, posts: ReadonlyArray<PostData>) =>
  s3
    .putObject({
      Body: JSON.stringify(posts),
      Bucket: pubbucket,
      Key: getFileName(time),
      ContentType: 'application/json',
      CacheControl: 'public',
      Expires: convert(ZonedDateTime.now(ZoneId.UTC).plusHours(4)).toDate(),
    })
    .promise();

const doit: AWSLambda.ScheduledHandler = async ({ time }) => {
  const [
    { text, Author, Language, Num, Title },
    oldPosts,
    visibility,
    nonce,
  ] = await Promise.all([
    findRandomBook(),
    getOldPosts(time),
    pickVisibility(),
    makeNonce(),
  ]);
  const snippet = findPhrasing(text);
  const lang = codeForLang(Language);
  const status = await post({
    status: snippet,
    nonce,
    language: lang,
    visibility,
    cw: warning(snippet),
  });
  const newPost: PostData = {
    url: status.url,
    post: snippet,
    book: Title,
    bookId: Num,
    author: Author,
    ts: status.created_at,
    lang,
  };
  console.log(newPost);
  await savePosts(time, [newPost, ...oldPosts]);
};

export default doit;
