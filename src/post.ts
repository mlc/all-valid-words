import AWS from 'aws-sdk';
import { randomBytes } from 'crypto';
import { convert, ZonedDateTime, ZoneId } from 'js-joda';
import memoize from 'lodash/memoize';
import fetch from 'node-fetch';
import { ungzip } from 'node-gzip';
import weightedRandomObject from 'weighted-random-object';
import { promisify } from 'util';

import langs from './langs';
import randomNumber from './random-number';

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

type MastoVisibility = 'public' | 'unlisted' | 'private' | 'direct';

interface MastoStatus {
  id: string;
  uri: string;
  created_at: string;
  account: unknown;
  content: string;
  visibility: MastoVisibility;
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: Array<unknown>;
  application: unknown;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string | null;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  reblog: MastoStatus | null;
}

const s3 = new AWS.S3();

const bucket = 'gutenberg-data.oulipo.link';
const metadataFile = 'gutenberg-metadata.json.gz';
const pubbucket = 'words.oulipo.link';
const postsFile = 'posts.json';

const spaces = /[\p{White_Space}]+/gu;
const PUBLIC_ODDS = 6;

export const metadata: () => Promise<Array<GutenbergBook>> = memoize(() =>
  s3
    .getObject({ Bucket: bucket, Key: metadataFile })
    .promise()
    .then(({ Body }) => ungzip(Body as Buffer))
    .then(data => JSON.parse(data.toString()) as Array<GutenbergBook>)
    .then(data =>
      data.filter(
        ({ 'Copyright Status': [cs] }) =>
          cs === 'Not copyrighted in the United States.' ||
          cs === 'Public domain in the USA.'
      )
    )
);

const getOldPosts = (): Promise<ReadonlyArray<PostData>> =>
  s3
    .getObject({ Bucket: pubbucket, Key: postsFile })
    .promise()
    .then(({ Body }) => JSON.parse((Body as Buffer).toString()))
    .catch(e => {
      if (e.code === 'NoSuchKey') {
        return [];
      }
      throw e;
    });

export const findBook = async (
  file: GutenbergBook
): Promise<GutenbergBookWithText> => {
  const text = await s3
    .getObject({ Bucket: bucket, Key: `${file['gd-path']}.gz` })
    .promise()
    .then(({ Body }) => ungzip(Body as Buffer))
    .then(book => book.toString().replace(spaces, ' '));
  return Object.assign({}, file, { text });
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
  const matches = findPhrasings(text).map(m => {
    const str = m.trim();
    const len = str.length;
    return { str, weight: len * len };
  });
  if (matches.length === 0) {
    throw new Error("couldn't find valid phrasing");
  }
  return weightedRandomObject(matches).str;
};

const pRandomBytes = promisify(randomBytes);

const makeNonce = (): Promise<string> =>
  pRandomBytes(32).then(buf => buf.toString('hex'));

const hanzi = /\p{Script=Han}/u;
const cyrl = /\p{Script=Cyrillic}/u;
const hangul = /\p{Script=Hangul}/u;
const greek = /\p{Script=Greek}/u;

const warning = (text: string): string | undefined => {
  if (hanzi.test(text)) {
    return 'hanzi';
  }
  if (cyrl.test(text)) {
    return 'cyrillic';
  }
  if (hangul.test(text)) {
    return 'hangul';
  }
  if (greek.test(text)) {
    return 'doric';
  }
  return undefined;
};

const pickVisibility = async (): Promise<MastoVisibility> => {
  const n = await randomNumber(PUBLIC_ODDS - 1);
  return n === 0 ? 'public' : 'unlisted';
};

const post = (
  status: string,
  nonce: string,
  language: string | undefined,
  visibility: MastoVisibility | undefined,
  cw: string | undefined
): Promise<MastoStatus> =>
  fetch('https://oulipo.social/api/v1/statuses', {
    method: 'post',
    body: JSON.stringify({
      status,
      visibility,
      language,
      spoiler_text: cw, // eslint-disable-line @typescript-eslint/camelcase
    }),
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': nonce,
    },
  }).then(r => r.json() as Promise<any>);

export const codeForLang = (
  languages: ReadonlyArray<string>
): string | undefined => {
  if (languages.length !== 1) {
    return undefined;
  }
  return langs[languages[0]];
};

const savePosts = (posts: ReadonlyArray<PostData>) =>
  s3
    .putObject({
      Body: JSON.stringify(posts),
      Bucket: pubbucket,
      Key: postsFile,
      ContentType: 'application/json',
      CacheControl: 'public',
      Expires: convert(ZonedDateTime.now(ZoneId.UTC).plusHours(4)).toDate(),
    })
    .promise();

const doit: AWSLambda.ScheduledHandler = async () => {
  const [
    { text, Author, Language, Num, Title },
    oldPosts,
    visibility,
    nonce,
  ] = await Promise.all([
    findRandomBook(),
    getOldPosts(),
    pickVisibility(),
    makeNonce(),
  ]);
  const snippet = findPhrasing(text);
  const lang = codeForLang(Language);
  const status = await post(snippet, nonce, lang, visibility, warning(snippet));
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
  await savePosts([newPost, ...oldPosts]);
};

export default doit;
