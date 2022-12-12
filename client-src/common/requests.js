import {FETCH_ERRORS} from "../../common-src/Constants";

const requestPost = (url, bodyDict) => {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    'body': JSON.stringify(bodyDict),
  }).then((response) => {
    response.errorReason = null;
    if (response.url.indexOf('.cloudflareaccess.com/cdn-cgi/access/login/') !== -1) {
      response.errorReason = FETCH_ERRORS.REFRESH_JWT_TOKEN;
    } else if (!response.ok) {
      response.errorReason = FETCH_ERRORS.SERVER_RESPONSE;
    }
    if (response.errorReason) {
      return Promise.reject(response);
    }
    try {
      return response.json();
    } catch (error) {
      response.errorReason = FETCH_ERRORS.PARSE_JSON;
      return Promise.reject(response);
    }
  });
};

function _uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, onR2OpsFailure) {
  const { size, type } = file;
  requestPost('/admin/ajax/r2-ops', {
    size,
    key: cdnFilename,
    type,
  }).then((res) => {
    const fileReader = new FileReader();
    fileReader.onloadend = (e) => {
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
  }).catch((response) => {
    onR2OpsFailure(response);
  });
}

function uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, onR2OpsFailure) {
  _uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, (response) => {
    console.log(response);
    console.log(response.errorReason, response.url);
    console.log(onR2OpsFailure);
    if (response.errorReason === FETCH_ERRORS.REFRESH_JWT_TOKEN) {
      fetch(response.url)
        .then((response) => {
          console.log('renew jwt token!');
          console.log(response);
          // _uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, () => {});
        })
    }
  });
}

const Requests = {
  post: requestPost,
  upload: uploadFile,
};

export default Requests;
