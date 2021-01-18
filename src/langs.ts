export const langs: { [lang: string]: string } = {
  Afrikaans: 'af',
  Aleut: 'ale',
  Arabic: 'ar',
  Arapaho: 'arp',
  Breton: 'br',
  Bulgarian: 'bg',
  Catalan: 'ca',
  Cebuano: 'ceb',
  Chinese: 'zh',
  Czech: 'cs',
  Danish: 'da',
  Dutch: 'nl',
  English: 'en',
  Esperanto: 'eo',
  Finnish: 'fi',
  French: 'fr',
  Frisian: 'fy',
  Friulian: 'fur',
  'Gaelic, Scottish': 'gd',
  Galician: 'gl',
  Gamilaraay: 'kld',
  German: 'de',
  Giangan: 'bgi',
  Greek: 'el',
  Hebrew: 'he',
  Hungarian: 'hu',
  Icelandic: 'is',
  Iloko: 'ilo',
  Interlingua: 'ia',
  Inuktitut: 'iu',
  Irish: 'ga',
  Italian: 'it',
  Japanese: 'ja',
  Kashubian: 'csb',
  Khasi: 'kha',
  Korean: 'ko',
  Latin: 'la',
  Lithuanian: 'lt',
  Maori: 'mi',
  'Mayan Languages': 'myn',
  'Middle English': 'enm',
  Nahuatl: 'nah',
  Norwegian: 'no',
  Norweigan: 'no',
  Occitan: 'oc',
  'Old English': 'ang',
  Polish: 'pl',
  Portuguese: 'pt',
  Romanian: 'ro',
  Russian: 'ru',
  Sanskrit: 'sa',
  Serbian: 'sr',
  Spanish: 'es',
  Swedish: 'sv',
  Tagalog: 'tl',
  Welsh: 'cy',
  Yiddish: 'yi',
};

export const codeForLang = (
  languages: ReadonlyArray<string>
): string | undefined => {
  if (!languages || languages.length !== 1) {
    return undefined;
  }
  return langs[languages[0]];
};
