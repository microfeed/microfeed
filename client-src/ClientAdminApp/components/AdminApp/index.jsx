import React from 'react';

export default class AdminApp extends React.Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);

    this.state = {
      text: '',
    }
  }

  componentDidMount() {
  }

  async handleChange(event) {
    const file = event.target.files[0];

    const {size, name} = event.target.files[0];
    const rawResponse = await fetch('/api/r2-ops', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size,
        name,
      })
    });
    const res = await rawResponse.json();

    const fileReader = new FileReader();
    fileReader.onloadend = async (e) => {
      const arrayBuffer = e.target.result;
      const response = await fetch(res.url, {
        method: 'PUT',
        body: arrayBuffer,
      });
      console.log(response.ok);
    };
    fileReader.readAsArrayBuffer(file);
  }

  render() {
    return (<div>
      <form>
        <h1>Upload large file</h1>
        <input type="file" onChange={this.handleChange}/>
      </form>
    </div>);
  }
}
