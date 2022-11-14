import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";
import {ENCLOSURE_CATEGORIES} from "../../common-src/Constants";

const Mustache = require('mustache');

function decorateMediaFileForEpisode(episode) {
   episode.episodeUrl = PUBLIC_URLS.pageEpisode(episode.id, episode.title);
   episode.pubDate = humanizeMs(episode.pubDateMs);
   episode.descriptionText = convert(episode.description, {});

  if (episode.mediaFile && episode.mediaFile.category) {
    episode.mediaFile.isAudio = episode.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
    episode.mediaFile.isDocument = episode.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
    episode.mediaFile.isExternalUrl = episode.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
    episode.mediaFile.isVideo = episode.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
  }
}

export default class Theme {
  constructor(jsonData, settings=null) {
    this.jsonData = jsonData;
    this.settings = settings;

    this.theme = 'default';
    if (settings && settings.styles && settings.styles.currentTheme) {
      this.theme = settings.styles.currentTheme;
    }
    // const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    // this.KEY = `${projectPrefix(env)}/database/${LISTEN_HOST_VERSION}-feed.json`;
    // this.LH_DB = LH_DATABASE;
    // this.LISTEN_HOST_VERSION = LISTEN_HOST_VERSION;
    // this.content = null;
  }

  name() {
    return this.theme;
  }

  getWebHeader() {
    const tmpl = this.getWebHeaderTmpl();
    const html = Mustache.render(tmpl, {});
    return {html};
  }

  getWebHeaderTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/web_header.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webHeader;
    }
    return tmpl;
  }

  getWebFooter() {
    const tmpl = this.getWebFooterTmpl();
    const html = Mustache.render(tmpl, {});
    return {html};
  }

  getWebFooterTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/web_footer.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].webFooter;
    }
    return tmpl;
  }

  getRssStylesheetTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
      // TODO: configure esbuild to load xsl?
      tmpl = require('../common/default_themes/rss_stylesheet.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].rssStylesheet;
    }
    return tmpl;
  }

  getRssStylesheet() {
    const tmpl = this.getRssStylesheetTmpl();
    const stylesheet = Mustache.render(tmpl, {});
    return {
      stylesheet,
    };
  }

  getFeedWeb() {
    const tmpl = this.getFeedWebTmpl();
    this.jsonData.episodes.forEach(eps => decorateMediaFileForEpisode(eps));
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
    });
    return {
      html,
    };
  }

  getFeedWebTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/feed_web.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].feedWeb;
    }
    return tmpl;
  }

  getEpisodeWeb(episode) {
    decorateMediaFileForEpisode(episode);
    const tmpl = this.getEpisodeWebTmpl();
    const html = Mustache.render(tmpl, {
      ...this.jsonData,
      episode,
    });
    return {
      html,
    };
  }

  getEpisodeWebTmpl() {
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/episode_web.html');
    } else {
      tmpl = this.settings.styles.themes[this.theme].episodeWeb;
    }
    return tmpl;
  }
}
