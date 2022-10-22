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
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", res.url, true);
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            console.log("upload progress:", event.loaded / event.total);
          }
        });
        xhr.addEventListener("loadend", () => {
          console.log('done!');
          console.log(xhr.readyState === 4 && xhr.status === 200);
        });
        xhr.send(arrayBuffer);
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
