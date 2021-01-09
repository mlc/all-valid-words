import {
  DateTimeFormatter,
  TemporalAccessor,
  ZonedDateTime,
  ZoneId,
} from '@js-joda/core';

const ym = DateTimeFormatter.ofPattern('yyyy-MM');

export const getFileName = (ts: string | TemporalAccessor): string => {
  const temporal =
    typeof ts === 'string'
      ? ZonedDateTime.parse(ts).withZoneSameInstant(ZoneId.UTC)
      : ts;
  return `posts/${ym.format(temporal)}.json`;
};
