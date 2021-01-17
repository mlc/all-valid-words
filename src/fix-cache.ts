import { ZonedDateTime, ZoneId } from '@js-joda/core';

import { getFileName } from './date';
import s3 from './s3';

const fixCache = (Bucket: string, time: string): Promise<unknown> => {
  const now = ZonedDateTime.parse(time).withZoneSameInstant(ZoneId.UTC);
  const fn = getFileName(now.minusMonths(1));
  return s3
    .copyObject({
      Bucket,
      Key: fn,
      CopySource: `${Bucket}/${fn}`,
      MetadataDirective: 'REPLACE',
      ContentType: 'application/json',
      CacheControl: 'public,max-age=7776000',
    })
    .promise();
};

export default fixCache;
