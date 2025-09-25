import {ResponseBuilder} from "../../edge-src/common/PageUtils";
import {STATUSES} from "../../common-src/Constants";

export async function onRequestGet({request, env}) {
  const schemaResponseBuilder = new SchemaJsonResponseBuilder(env, request, {
    queryKwargs: {
      status__in: [STATUSES.PUBLISHED, STATUSES.UNLISTED],
    },
  });

  return await schemaResponseBuilder.getResponse({
    checkIsAllowed: true,
    isValid: (schema) => {
      return schema && schema.items && schema.items.length > 0;
    },
  });
}

// Schema JSON Response Builder for plain schema API
class SchemaJsonResponseBuilder extends ResponseBuilder {
  get _contentType() {
    return 'application/json;charset=UTF-8';
  }

  _getResponse(props) {
    const res = super._getResponse(props);

    if (props) {
      if (props.checkIsAllowed) {
        const {subscribeMethods} = this.settings;
        let notFoundRes = ResponseBuilder.notEnabledResponse(subscribeMethods, 'json');
        if (notFoundRes) {
          return notFoundRes;
        }
      }
      if (props.isValid) {
        if (!props.isValid(this.schema)) {
          return ResponseBuilder.Response404();
        }
      }
    }
    
    // Return the plain schema directly (not JSON Feed format)
    const newResponse = new Response(JSON.stringify(this.schema), res);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  }
}
