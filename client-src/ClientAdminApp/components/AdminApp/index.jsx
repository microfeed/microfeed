import React from 'react';

export default class AdminApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      text: '',
    }
  }

  componentDidMount() {
  }

  render() {
    return (<div>
      Render admin app!
    </div>);
  }
}
