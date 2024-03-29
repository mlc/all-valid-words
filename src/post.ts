import { randomInt } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { convert, ZonedDateTime, ZoneId } from '@js-joda/core';
import memoize from 'memoizee';
import {
  blacklisted as blocklisted,
  addWords as addBlocklist,
} from 'wordfilter';
import type { ScheduledHandler } from 'aws-lambda';

import { getFileName } from './date';
import fixCache from './fix-cache';
import { codeForLang } from './langs';
import { MastoVisibility, post } from './mastodon';
import { pRandomBytes, weightedRandom } from './rng';
import s3 from './s3';
import { gunzip } from './streams';

export interface GutenbergBook {
  Author: string[];
  'Author Birth': string[];
  'Author Given': string[];
  'Author Death': string[];
  'Author Surname': string[];
  'Copyright Status': string[];
  Language: string[];
  'LoC Class': string[];
  Num: string;
  Subject: string[];
  Title: string[];
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
  book: string[];
  bookId: string;
  author: string[];
  lang?: string;
  ts?: string;
}

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';
const pubbucket = 'words.oulipo.link';

const spaces = /[\p{White_Space}]+/gu;
const allValidSymbols =
  / [^EeÈÉÊËèéêëĒēĔĕĖėĘęĚěƐȄȅȆȇȨȩɛεϵЄЕеєҽԐԑعᎬᗴᘍᘓᥱᴱᵉᵋḘḙḚḛẸẹẺẻẼẽₑℇ℮ℯℰⅇ∈ⒺⓔⲈⲉⴹ㋍㋎ꗋꜪꜫﻉＥｅ𝈡𝐄𝐞𝐸𝑒𝑬𝒆𝓔𝓮𝔈𝔢𝔼𝕖𝕰𝖊𝖤𝖾𝗘𝗲𝘌𝘦𝙀𝙚𝙴𝚎🄴æœ]{30,490} /giu;
const hanzi = /\p{Script=Han}/u;
const cyrl = /\p{Script=Cyrillic}/u;
const hangul = /\p{Script=Hangul}/u;
const greek = /\p{Script=Greek}/u;

const PUBLIC_ODDS = 6;

export const metadata: () => Promise<GutenbergBook[]> = memoize(
  async () => {
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: metadataFile })
    );
    const data = JSON.parse(
      await gunzip(Body as NodeJS.ReadableStream)
    ) as GutenbergBook[];
    return data.filter(
      ({ 'Copyright Status': [cs] }) =>
        cs === 'Not copyrighted in the United States.' ||
        cs === 'Public domain in the USA.'
    );
  },
  { promise: true }
);

const getOldPosts = async (time: string): Promise<readonly PostData[]> => {
  try {
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: pubbucket, Key: getFileName(time) })
    );
    const body = await (Body?.transformToString() ?? '');
    return JSON.parse(body);
  } catch (e) {
    if (e instanceof Error && e.name === 'NoSuchKey') {
      await fixCache(pubbucket, time).catch(console.warn);
      return [];
    } else {
      throw e;
    }
  }
};

export const findBook = async (
  file: GutenbergBook
): Promise<GutenbergBookWithText> => {
  const { Body } = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: `${file['gd-path']}.gz` })
  );
  const book = await gunzip(Body as NodeJS.ReadableStream);
  const text = book.replace(spaces, ' ');
  return { ...file, text };
};

export const findRandomBook = async (): Promise<GutenbergBookWithText> => {
  const gutenberg = await metadata();
  const file = gutenberg[randomInt(gutenberg.length)];
  return findBook(file);
};

export const findPhrasings = (text: string): readonly string[] =>
  text.match(allValidSymbols) || [];

const findPhrasing = (text: string, bookId: string): string => {
  const matches = findPhrasings(text)
    .filter((phrasing) => !blocklisted(phrasing))
    .map((m) => {
      const str = m.trim();
      const len = str.length;
      return { str, weight: len * len };
    });
  if (matches.length === 0) {
    throw new Error(`couldn't find valid phrasing in book ${bookId}`);
  }
  return weightedRandom(matches).str;
};

const makeNonce = (): Promise<string> =>
  pRandomBytes(32).then((buf) => buf.toString('hex'));

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

const pickVisibility = (): MastoVisibility => {
  const n = randomInt(PUBLIC_ODDS);
  return n === 0 ? 'public' : 'unlisted';
};

const savePosts = (time: string, posts: readonly PostData[]) =>
  s3.send(
    new PutObjectCommand({
      Body: JSON.stringify(posts),
      Bucket: pubbucket,
      Key: getFileName(time),
      ContentType: 'application/json',
      CacheControl: 'public',
      Expires: convert(ZonedDateTime.now(ZoneId.UTC).plusHours(4)).toDate(),
    })
  );

const doit: ScheduledHandler = async ({ time }) => {
  addBlocklist(['blackamoor']);
  const [{ text, Author, Language, Num, Title }, oldPosts, visibility, nonce] =
    await Promise.all([
      findRandomBook(),
      getOldPosts(time),
      pickVisibility(),
      makeNonce(),
    ]);
  const snippet = findPhrasing(text, Num);
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
