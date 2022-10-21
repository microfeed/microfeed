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
    /*
lastModified: 1664045743901
lastModifiedDate: Sat Sep 24 2022 11:55:43 GMT-0700 (Pacific Daylight Time) {}
name: "podcast-db-claritas-2022-09-24.db"
size: 7766495232
type: ""
webkitRelativePath: ""
     */
    // console.log(event.target.files[0]);
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
    console.log(await rawResponse.json());
  }

  render() {
    return (<div>
      <form>
        <h1>Upload large file</h1>
        <input type="file" onChange={this.handleChange}/>
        <button type="submit" className="border p-2">Upload</button>
      </form>
    </div>);
  }
}
