/* eslint-disable camelcase */

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
