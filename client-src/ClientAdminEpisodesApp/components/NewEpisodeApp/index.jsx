import React from 'react';

export default class NewEpisodeApp extends React.Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);

    this.state = {
      mediaUrl: null,
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
    const rawResponse = await fetch('/admin/ajax/r2-ops', {
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
        const { mediaBaseUrl, presignedUrl } = res;
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            console.log("upload progress:", event.loaded / event.total);
          }
        });
        xhr.addEventListener("loadend", () => {
          const mediaUrl = `${mediaBaseUrl}/${name}`;
          this.setState({mediaUrl});
          console.log('done!');
          console.log(xhr.readyState === 4 && xhr.status === 200);
        });
        xhr.send(arrayBuffer);
      }
    };
    fileReader.readAsArrayBuffer(file);
  }

  render() {
    const { mediaUrl } = this.state;
    return (<div>
      <form>
        <h1>Upload large file</h1>
        <input type="file" onChange={this.handleChange}/>
        {mediaUrl && <div><a href={mediaUrl}>{mediaUrl}</a></div>}
      </form>
    </div>);
  }
}
