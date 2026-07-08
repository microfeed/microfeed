import axios from 'axios';

const axiosGet = (url) => {
  return axios.get(url, {
  });
};

const axiosPost = (url, bodyDict) => {
  return axios.post(url, bodyDict, {
  });
};

const axiosPut = (url, bodyDict) => {
  return axios.put(url, bodyDict, {
  });
};

const axiosDelete = (url) => {
  return axios.delete(url, {
  });
};

// Compute a hex sha-256 of an ArrayBuffer, used to dedup identical uploads.
async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Read a File/Blob into an ArrayBuffer.
function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onloadend = (e) => resolve(e.target.result);
    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
}

// Register a stored object in the media inventory (best-effort; never blocks
// the upload result on failure).
function registerMedia({key, url, hash, size, contentType, originalFilename, width, height}) {
  return axiosPost('/admin/ajax/media/register', {
    key, url, hash, size, contentType, originalFilename, width, height,
  }).catch(() => {});
}

function uploadFile(file, cdnFilename, onProgress, onUploaded, onFailure, onR2OpsFailure, meta = {}) {
  const { size, type, name } = file;
  readArrayBuffer(file).then(async (arrayBuffer) => {
    if (!arrayBuffer) {
      return;
    }

    // 1) Dedup: if a byte-identical image is already in the inventory, reuse
    //    its url and skip re-uploading a duplicate object.
    let hash = null;
    try {
      hash = await sha256Hex(arrayBuffer);
      const check = await axiosPost('/admin/ajax/media/check-hash', {hash});
      if (check && check.data && check.data.deduped && check.data.url) {
        onProgress(1);
        onUploaded(check.data.url, arrayBuffer, meta);
        return;
      }
    } catch (e) {
      // Hashing/dedup is best-effort; fall through to a normal upload.
    }

    // 2) Get a presigned url and PUT the bytes, as before.
    axiosPost('/admin/ajax/r2-ops', {
      size,
      key: cdnFilename,
      type,
    }).then((res) => {
      const {mediaBaseUrl, presignedUrl} = res.data;
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl, true);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      });
      xhr.addEventListener("loadend", () => {
        const mediaUrl = `${mediaBaseUrl}/${cdnFilename}`;
        if (xhr.readyState === 4 && xhr.status === 200) {
          // 3) Record the new object in the inventory (with its hash) so it can
          //    be reused and tracked, then hand the url back to the caller.
          // key === url === the internal, project/env-prefixed object key, so
          // it lines up with reconcileFromR2 (which keys rows by the full R2
          // object key) and dedup stays consistent across both paths.
          registerMedia({
            key: mediaUrl,
            url: mediaUrl,
            hash,
            size,
            contentType: type,
            originalFilename: name,
            width: meta.width,
            height: meta.height,
          })
            .then(() => onUploaded(mediaUrl, arrayBuffer, meta));
        }
      });
      xhr.addEventListener("error", (event) => {
        if (onFailure) {
          onFailure(event);
        }
      });
      xhr.send(arrayBuffer);
    }).catch((error) => {
      onR2OpsFailure(error);
    });
  }).catch((error) => {
    onR2OpsFailure(error);
  });
}

/**
 * Replace an existing media object's bytes IN PLACE. PUTs the new file to the
 * SAME r2 key so every reference to that url now serves the new file, then
 * refreshes the inventory row's metadata. `existingKey` is the media row's
 * internal, project/env-prefixed url (=== its r2 key).
 */
function replaceFile(file, existingKey, mediaId, onProgress, onDone, onFailure, meta = {}) {
  const {size, type} = file;
  readArrayBuffer(file).then(async (arrayBuffer) => {
    if (!arrayBuffer) {
      return;
    }
    let hash = null;
    try {
      hash = await sha256Hex(arrayBuffer);
    } catch (e) {
      // Hashing is best-effort.
    }
    axiosPost('/admin/ajax/r2-ops', {size, key: existingKey, type}).then((res) => {
      const {presignedUrl} = res.data;
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl, true);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(event.loaded / event.total);
        }
      });
      xhr.addEventListener("loadend", () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          axiosPost('/admin/ajax/media/replace', {id: mediaId, hash, size, contentType: type, width: meta.width, height: meta.height})
            .then(() => onDone && onDone())
            .catch((err) => onFailure && onFailure(err));
        } else if (onFailure) {
          onFailure(new Error('upload failed'));
        }
      });
      xhr.addEventListener("error", (event) => onFailure && onFailure(event));
      xhr.send(arrayBuffer);
    }).catch((error) => onFailure && onFailure(error));
  }).catch((error) => onFailure && onFailure(error));
}

const Requests = {
  axiosGet,
  axiosPost,
  axiosPut,
  axiosDelete,
  upload: uploadFile,
  replace: replaceFile,
};

export default Requests;
