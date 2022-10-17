import React from 'react';

export default class ClientHomeApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      text: '',
    }
  }

  componentDidMount() {
  }

  render() {
    return (<div className="font-semibold text-xl text-blue-500">
      Rendered from client-side react
    </div>);
  }
}
