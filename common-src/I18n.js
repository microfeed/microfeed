export function normalizeLanguage(language = 'en-us') {
  return String(language || 'en-us').trim().toLowerCase();
}

export function isChineseLanguage(language = 'en-us') {
  return normalizeLanguage(language).startsWith('zh');
}

export function pickTextByLanguage(language, zhText, enText) {
  return isChineseLanguage(language) ? zhText : enText;
}

export function getPublicThemeTexts(language = 'en-us') {
  return {
    subscribe: pickTextByLanguage(language, '订阅：', 'Subscribe:'),
    about: pickTextByLanguage(language, '简介', 'About'),
    latest: pickTextByLanguage(language, '最新内容', 'Latest'),
    noItems: pickTextByLanguage(language, '暂无内容。', 'No items.'),
    prev: pickTextByLanguage(language, '上一页', 'Prev'),
    next: pickTextByLanguage(language, '下一页', 'Next'),
    listen: pickTextByLanguage(language, '收听：', 'Listen:'),
    watch: pickTextByLanguage(language, '观看：', 'Watch:'),
    downloadFile: pickTextByLanguage(language, '下载文件', 'Download file'),
    viewUrl: pickTextByLanguage(language, '查看链接', 'View url'),
    audioUnsupported: pickTextByLanguage(language, '你的浏览器暂不支持音频播放。', 'Your browser does not support the audio element.'),
    videoUnsupported: pickTextByLanguage(language, '你的浏览器暂不支持视频播放。', 'Your browser does not support the video element.'),
    rssFeedTitleSuffix: pickTextByLanguage(language, 'RSS 订阅页', 'RSS Feed'),
    author: pickTextByLanguage(language, '作者：', 'By'),
    categories: pickTextByLanguage(language, '分类：', 'Categories:'),
    website: pickTextByLanguage(language, '访问网站', 'Website'),
    view: pickTextByLanguage(language, '查看', 'View'),
    download: pickTextByLanguage(language, '下载', 'Download'),
  };
}
