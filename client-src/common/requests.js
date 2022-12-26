import axios from 'axios';

const axiosPost = (url, bodyDict) => {
  return axios.post(url, bodyDict, {
  });
};

function uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, onR2OpsFailure) {
  const { size, type } = file;
  axiosPost('/admin/ajax/r2-ops', {
    size,
    key: cdnFilename,
    type,
  }).then((res) => {
    const fileReader = new FileReader();
    fileReader.onloadend = (e) => {
      const arrayBuffer = e.target.result;
      if (arrayBuffer) {
        const {mediaBaseUrl, presignedUrl} = res.data;
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
            onUploaded(mediaUrl, arrayBuffer);
          }
          // this.setState({progressText: null, uploadStatus: null});
        });
        xhr.addEventListener("error", (event) => {
          if (onFailure) {
            onFailure(event);
          }
        });
        xhr.send(arrayBuffer);
      }
    };
    fileReader.readAsArrayBuffer(file);
  }).catch((error) => {
    onR2OpsFailure(error);
  });
}

const Requests = {
  axiosPost,
  upload: uploadFile,
};

export default Requests;
