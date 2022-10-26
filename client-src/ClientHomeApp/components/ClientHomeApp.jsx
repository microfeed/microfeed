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
    return (<div className="text-center text-xs mt-32 mb-8 text-gray-400">
      powered by listen.host
    </div>);
  }
}
