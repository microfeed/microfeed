import React from 'react';
const axios = require('axios').default;

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

    const {
      size,
      name,
      type,
    } = event.target.files[0];
    const rawResponse = await fetch('/api/r2-ops', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size,
        key: name,
        type,
      })
    });
    const res = await rawResponse.json();

    const fileReader = new FileReader();
    fileReader.onloadend = async (e) => {
      const arrayBuffer = e.target.result;
      if (arrayBuffer) {
        console.log(res.url);
        axios.request({
          method: 'put',
          url: res.url,
          // headers: {
          //   'Content-Type': type,
          // },
          data: arrayBuffer,
          onUploadProgress: (p) => {
            console.log(p.loaded / p.total);
            //this.setState({
            //fileprogress: p.loaded / p.total
            //})
          }
        }).then(data => {
          console.log('done');
          console.log(data);
          //this.setState({
          //fileprogress: 1.0,
          //})
        });
      }
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
