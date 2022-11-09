import {PUBLIC_URLS} from "../../common-src/StringUtils";
import {humanizeMs} from "../common/TimeUtils";
import {convert} from "html-to-text";
import tmpl from "../common/default_themes/web_header.html";

const Mustache = require('mustache');

function episodeUrl() {
  return PUBLIC_URLS.pageEpisode(this.id, this.title);
}

function pubDate(episode=null) {
  let eps = episode;
  if (!episode) {
    eps = this;
  }
  return humanizeMs(eps.pubDateMs);
}

function descriptionText() {
  return convert(this.description, {});
}

export default class Theme {
  constructor(jsonData, theme = null) {
    this.jsonData = jsonData;
    this.theme = theme || 'default';
    // const {LISTEN_HOST_VERSION, LH_DATABASE} = env;
    // this.KEY = `${projectPrefix(env)}/database/${LISTEN_HOST_VERSION}-feed.json`;
    // this.LH_DB = LH_DATABASE;
    // this.LISTEN_HOST_VERSION = LISTEN_HOST_VERSION;
    // this.content = null;
  }

  getWebHeader() {
    const tmpl = require('../common/default_themes/web_header.html');
    return Mustache.render(tmpl, {});
  }

  getWebFooter() {
    const tmpl = require('../common/default_themes/web_footer.html');
    return Mustache.render(tmpl, {});
  }

  getRssStylesheet() {
    let tmpl = null;
    if (this.theme === 'default') {
      // XXX: this should've been .xsl, instead of .html. But esbuild can't load xsl.
      // TODO: configure esbuild to load xsl?
      tmpl = require('../common/default_themes/rss_stylesheet.html');
    } else {
      console.log(this.theme);
    }
    const stylesheet = Mustache.render(tmpl, {});
    return {
      stylesheet,
    };
  }

  getFeedWeb() {
    const {podcast, episodes} = this.jsonData;
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/feed_web.html');
    } else {
      console.log(this.theme);
    }
    const html = Mustache.render(tmpl, {
      podcast,
      episodes,
      episodeUrl,
      pubDate,
      descriptionText,
    });
    return {
      html,
    };
  }

  getEpisodeWeb(episode) {
    const {podcast} = this.jsonData;
    episode.pubDate = pubDate(episode);
    let tmpl = null;
    if (this.theme === 'default') {
      tmpl = require('../common/default_themes/episode_web.html');
    } else {
      console.log(this.theme);
    }
    const html = Mustache.render(tmpl, {
      episode,
      podcast,
    });
    return {
      html,
    };
  }

  getRssStyle() {
  }
}
