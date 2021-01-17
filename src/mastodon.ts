/* eslint-disable camelcase */
import fetch from 'node-fetch';

export type MastoVisibility = 'public' | 'unlisted' | 'private' | 'direct';

export interface MastoStatus {
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

interface PostParams {
  status: string;
  nonce: string;
  language?: string;
  visibility?: MastoVisibility;
  cw?: string;
}

export const post = ({
  status,
  nonce,
  language,
  visibility,
  cw,
}: PostParams): Promise<MastoStatus> =>
  fetch('https://oulipo.social/api/v1/statuses', {
    method: 'post',
    body: JSON.stringify({
      status,
      visibility,
      language,
      spoiler_text: cw,
    }),
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': nonce,
    },
  }).then(r => {
    if (r.ok) {
      return r.json() as Promise<MastoStatus>;
    } else {
      return r.text().then(text => {
        console.error(text);
        throw r.statusText;
      });
    }
  });
