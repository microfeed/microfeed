import React from 'react';
// import './App.css';

export default class App extends React.Component {
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
      Rendered from client-side react
    </div>);
  }
}
