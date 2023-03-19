/* eslint-disable camelcase */
import { getToken } from './secret';

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
  media_attachments: unknown[];
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

export const post = async ({
  status,
  nonce,
  language,
  visibility,
  cw,
}: PostParams): Promise<MastoStatus> => {
  const token = await getToken();
  const r = await fetch('https://oulipo.social/api/v1/statuses', {
    method: 'post',
    body: JSON.stringify({
      status,
      visibility,
      language,
      spoiler_text: cw,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': nonce,
    },
  });
  if (r.ok) {
    return r.json() as Promise<MastoStatus>;
  } else {
    const text = await r.text();
    console.error(text);
    throw r.statusText;
  }
};
