import { ITEM_STATUSES_STRINGS_DICT, STATUSES } from '../../../common-src/constants';
import {datetimeLocalToMs} from "../../../common-src/TimeUtils";

// TODO: defensive code to handle some common errors
export async function onRequestPost({ request, data }) {
  const {
    id, // eslint-disable-line no-unused-vars
    ...itemJson
  } = await request.json();
  itemJson.status = ITEM_STATUSES_STRINGS_DICT[itemJson.status] || STATUSES.PUBLISHED;
  itemJson.date_published_ms = itemJson.date_published_ms ? itemJson.date_published_ms : datetimeLocalToMs(new Date());

  const { feedCrud } = data;
  const itemId = feedCrud.upsertItem(itemJson);

  return new Response(JSON.stringify({
    id: itemId,
  }), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
