const requestPost = (url, bodyDict) => {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    'body': JSON.stringify(bodyDict),
  }).then((response) => response.json());
};

async function uploadFile(file, cdnFilename, onProgress, onUploaded) {
  const { size, type } = file;
  const rawResponse = await fetch('/admin/ajax/r2-ops', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      size,
      key: cdnFilename,
      type,
    })
  });
  const res = await rawResponse.json();
  const fileReader = new FileReader();
  fileReader.onloadend = async (e) => {
    const arrayBuffer = e.target.result;
    if (arrayBuffer) {
      const {mediaBaseUrl, presignedUrl} = res;
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl, true);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
          // this.setState({progressText: `${parseFloat(event.loaded / event.total * 100.0).toFixed(2)}%`});
        }
      });
      xhr.addEventListener("loadend", () => {
        const mediaUrl = `${mediaBaseUrl}/${cdnFilename}`;
        if (xhr.readyState === 4 && xhr.status === 200) {
          // this.props.onImageUploaded(mediaUrl);
          onUploaded(mediaUrl);
        }
        // this.setState({progressText: null, uploadStatus: null});
      });
      xhr.send(arrayBuffer);
    }
  };
  fileReader.readAsArrayBuffer(file);
}

const Requests = {
  post: requestPost,
  upload: uploadFile,
};

export default Requests;
