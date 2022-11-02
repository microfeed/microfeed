import {randomShortUUID, buildAudioUrlWithTracking} from "./StringUtils";

test('randomShortUUID', () => {
  expect(randomShortUUID().length).toBe(11);
  expect(randomShortUUID(20).length).toBe(20);
});

test('buildAudioUrlWithTracking', () => {
  const audioUrl = 'https://www.audio.com/audio.mp3'
  const trackingUrls = [
    'http://firsturl.com',
    'https://secondurl.com/abc/',
    'https://thridurl.com/aaa/bbb',
    'www.noprotocal.com/asdfsad',
  ];
  const finalUrl = 'https://firsturl.com/secondurl.com/abc/thridurl.com/aaa/www.noprotocal.com/www.audio.com/audio.mp3';
  expect(buildAudioUrlWithTracking(audioUrl, trackingUrls)).toBe(finalUrl);
});
