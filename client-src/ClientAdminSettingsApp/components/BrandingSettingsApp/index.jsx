import React from 'react';

export default class BrandingSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }

  render() {
    return (<form className="lh-page-card">
      <h2 className="lh-page-title">
        <div className="flex">
          <div className="flex-1">Branding</div>
          <div className="flex-none">Button</div>
        </div>
      </h2>
      <div>
        public / pass code
      </div>
    </form>);
  }
}
