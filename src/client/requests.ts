import axios from 'axios';
import {ADMIN_URLS} from "@/shared/StringUtils";
import {convertImageToAvif} from "@/client/ImageUploadUtils";
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

async function uploadFile(file: any, cdnFilename: any, onProgress: any, onUploaded: any, onFailure: any, onR2OpsFailure: any) {
  // Convert images to AVIF client-side before upload so every image stored in
  // R2 uses the same compact format. Non-image files (audio/video) pass
  // through unchanged, and already-AVIF blobs (e.g. from the cover-art
  // uploader) are left as-is. The signed upload URL must be created from the
  // converted blob's size and type so the server's length check matches.
  const isImage = typeof file?.type === "string" && file.type.startsWith("image/");
  const uploadBlob = isImage ? await convertImageToAvif(file) : file;
  const convertedToAvif =
    uploadBlob !== file && uploadBlob.type === "image/avif";
  const finalFilename = convertedToAvif
    ? cdnFilename.replace(/\.[a-z0-9]+$/iu, ".avif")
    : cdnFilename;
  const { size, type } = uploadBlob;
  axiosPost(ADMIN_URLS.ajaxR2Ops(), {
    size,
    key: finalFilename,
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
          const mediaUrl = `${mediaBaseUrl}/${finalFilename}`;
          if (xhr.status >= 200 && xhr.status < 300) {
            onUploaded(mediaUrl, uploadBlob);
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
    fileReader.readAsArrayBuffer(uploadBlob);
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
