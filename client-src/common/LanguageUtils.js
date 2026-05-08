import {unescapeHtml} from "../../common-src/StringUtils";
import {isChineseLanguage, pickTextByLanguage} from "../../common-src/I18n";

export function getDocumentLanguage(defaultLanguage = 'en-us') {
  try {
    const feedContentEl = document.getElementById('feed-content');
    if (!feedContentEl) {
      return defaultLanguage;
    }
    const feed = JSON.parse(unescapeHtml(feedContentEl.innerHTML));
    return feed.channel && feed.channel.language ? feed.channel.language : defaultLanguage;
  } catch (error) {
    return defaultLanguage;
  }
}

export function isDocumentChinese(defaultLanguage = 'en-us') {
  return isChineseLanguage(getDocumentLanguage(defaultLanguage));
}

export function pickDocumentText(zhText, enText, defaultLanguage = 'en-us') {
  return pickTextByLanguage(getDocumentLanguage(defaultLanguage), zhText, enText);
}
