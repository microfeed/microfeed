import React from 'react';
import {OUR_BRAND} from "../../../../../../common-src/Constants";

const FETCH_STATUS__START = 1;

export default class WhatsNewApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      items: [],
      fetchStatus: FETCH_STATUS__START,
    };
  }

  componentDidMount() {
    const endpoint = OUR_BRAND.whatsnewEndpoint;

    this.setState({fetchStatus: FETCH_STATUS__START});
    fetch(endpoint).then((d) => d.json()).then((d) => {
      this.setState({
        items: d.items.slice(0, 5),
        fetchStatus: null,
      })
    }).catch(() => {
      this.setState({fetchStatus: null});
    });
  }

  render() {
    const {items, fetchStatus} = this.state;
    const fetching = fetchStatus === FETCH_STATUS__START;
    return (<div className="lh-page-card">
      <div className="lh-page-title">
        <a href={`https://${OUR_BRAND.domain}`}>{OUR_BRAND.domain}</a>の新着情報
      </div>
      <div>
        {fetching ? <div className="text-muted-color text-sm">
          読み込み中...
        </div> : <div className="grid grid-cols-1 gap-4">
          {items.map((item) => (<div key={`item-${item.id}`}>
            <div>
              <a href={item._microfeed.web_url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </div>
            <div className="text-xs text-muted-color mt-1">
              {item._microfeed.date_published_short}
            </div>
          </div>))}
          {items.length > 0 ? <div className="text-right">
            <a href={OUR_BRAND.whatsnewWebsite} target="_blank">続きを読む <span className="lh-icon-arrow-right" /></a>
          </div> : <div className="-text-xs text-muted-color mt-1">
            ニュースはありません。
          </div>}
        </div>}
      </div>
    </div>);
  }
}
