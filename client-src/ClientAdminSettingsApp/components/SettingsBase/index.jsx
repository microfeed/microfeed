import React from 'react';

export default class SettingsBase extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {submitForType, submitting, currentType, onSubmit, children, title} = this.props;
    const submittingForThis = submitForType === currentType;
    return (<form className="lh-page-card">
      <h2 className="lh-page-title">
        <div className="flex">
          <div className="flex-1">{title}</div>
          <div className="flex-none">
            <button
              disabled={submittingForThis || submitting}
              className="lh-btn lh-btn-brand-dark"
              onClick={onSubmit}
            >{submittingForThis ? 'Updating...' : 'Update'}</button>
          </div>
        </div>
      </h2>
      {children}
    </form>);
  }
}
