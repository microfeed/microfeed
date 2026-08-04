import axios from 'axios';
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {ImageMetadataTarget} from "@/types";

const axiosPost = (url: any, bodyDict: any) => {
  return axios.post(url, bodyDict, {
  });
};

const deleteImage = (
  imageUrl: string,
  target?: ImageMetadataTarget,
) => axios.delete(ADMIN_URLS.ajaxR2Ops(), {
  data: {imageUrl, target},
});

function uploadFile(file: any, cdnFilename: any, onProgress: any, onUploaded: any, onFailure: any, onR2OpsFailure: any) {
  const { size, type } = file;
  axiosPost(ADMIN_URLS.ajaxR2Ops(), {
    size,
    key: cdnFilename,
    type,
  }).then((res: any) => {
    const fileReader = new FileReader();
    fileReader.onloadend = (e: any) => {
      const arrayBuffer = e.target.result;
      if (arrayBuffer) {
        const {mediaBaseUrl, presignedUrl} = res.data;
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.upload.addEventListener("progress", (event: any) => {
          if (event.lengthComputable) {
            onProgress(event.loaded / event.total);
            // this.setState({progressText: `${parseFloat(event.loaded / event.total * 100.0).toFixed(2)}%`});
          }
        });
        xhr.addEventListener("load", () => {
          const mediaUrl = `${mediaBaseUrl}/${cdnFilename}`;
          if (xhr.status >= 200 && xhr.status < 300) {
            onUploaded(mediaUrl, arrayBuffer);
          } else if (onFailure) {
            onFailure({
              response: {
                data: xhr.responseText,
                status: xhr.status,
              },
            });
          }
        });
        xhr.addEventListener("error", (event: any) => {
          if (onFailure) {
            onFailure(event);
          }
        });
        xhr.send(arrayBuffer);
      }
    };
    fileReader.readAsArrayBuffer(file);
  }).catch((error: any) => {
    onR2OpsFailure(error);
  });
}

const Requests = {
  axiosPost,
  deleteImage,
  upload: uploadFile,
};

export default Requests;
