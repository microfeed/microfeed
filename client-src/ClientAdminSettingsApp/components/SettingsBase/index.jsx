import React from 'react';

export default class SettingsBase extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {submitForType, submitting, currentType, onSubmit, children, title, titleComponent} = this.props;
    const submittingForThis = submitForType === currentType;
    return (<form className="lh-page-card h-full">
      <h2 className="lh-page-title">
        <div className="flex">
          <div className="flex-1">
            {title}
            {titleComponent}
          </div>
          {onSubmit && <div className="flex-none">
            <button
              disabled={submittingForThis || submitting}
              className="lh-btn lh-btn-brand-dark"
              onClick={onSubmit}
            >{submittingForThis ? 'Updating...' : 'Update'}</button>
          </div>}
        </div>
      </h2>
      {children}
    </form>);
  }
}
