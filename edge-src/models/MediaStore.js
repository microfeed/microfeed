import {AwsClient} from "aws4fetch";
import {XMLParser} from "fast-xml-parser";
import {projectPrefix} from "../../common-src/R2Utils";

function isExternalOrEmpty(internalUrl) {
  if (!internalUrl) {
    return true;
  }
  return /^https?:\/\//i.test(internalUrl);
}

export class MediaStore {
  constructor(env) {
    this.env = env;
  }

  async deleteObject(internalUrl) {
    if (isExternalOrEmpty(internalUrl)) {
      return null;
    }

    const {env} = this;
    const accessKeyId = `${env.R2_ACCESS_KEY_ID}`;
    const secretAccessKey = `${env.R2_SECRET_ACCESS_KEY}`;
    const bucket = env.R2_PUBLIC_BUCKET;
    // The internally-stored media url is host-stripped but ALREADY includes the
    // project/environment prefix — uploads save `${projectPrefix}/${key}` (see
    // onGetR2PresignedUrlRequestPost's mediaBaseUrl = projectPrefix). So the R2
    // object key IS the internal url; do NOT prepend projectPrefix again.
    const endpoint = `https://${bucket}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${internalUrl}`;

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const request = new Request(endpoint, {
      method: "DELETE",
    });

    return aws.fetch(request);
  }

  /**
   * List EVERY object in the public bucket for this project/environment via the
   * S3 ListObjectsV2 API — all folders (`images/`, `media/…`) and all file
   * types (image/audio/video/document). Returns an array of
   * {key, size, lastModified} where `key` is the full object key (which,
   * matching how uploads are stored, already includes the project/env prefix
   * and equals the internal media url). Categorization/filtering is left to
   * callers so this stays a faithful, full listing for the explorer.
   */
  async listObjects() {
    const {env} = this;
    const accessKeyId = `${env.R2_ACCESS_KEY_ID}`;
    const secretAccessKey = `${env.R2_SECRET_ACCESS_KEY}`;
    const bucket = env.R2_PUBLIC_BUCKET;
    const prefix = `${projectPrefix(env)}/`;

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const parser = new XMLParser();
    const objects = [];

    let continuationToken = null;
    // Paginate through ListObjectsV2 results.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let endpoint = `https://${bucket}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/?list-type=2&prefix=${encodeURIComponent(prefix)}`;
      if (continuationToken) {
        endpoint += `&continuation-token=${encodeURIComponent(continuationToken)}`;
      }

      const response = await aws.fetch(new Request(endpoint, {method: "GET"}));
      const xmlText = await response.text();
      const parsed = parser.parse(xmlText);
      const result = parsed && parsed.ListBucketResult ? parsed.ListBucketResult : {};

      const contents = result.Contents;
      const list = Array.isArray(contents) ? contents : (contents ? [contents] : []);
      list.forEach((entry) => {
        if (!entry.Key) {
          return;
        }
        objects.push({
          key: entry.Key,
          size: typeof entry.Size === "number" ? entry.Size : parseInt(entry.Size, 10) || 0,
          lastModified: entry.LastModified || null,
        });
      });

      const isTruncated = result.IsTruncated === true || result.IsTruncated === "true";
      if (isTruncated && result.NextContinuationToken) {
        continuationToken = result.NextContinuationToken;
      } else {
        break;
      }
    }

    return objects;
  }
}

export function createMediaStore(env) {
  return new MediaStore(env);
}

export default MediaStore;
