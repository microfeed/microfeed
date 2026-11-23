import {contentApiRoute} from "@/server/content/operation";
import * as operations from "./operations";

export const listApiTags = contentApiRoute(operations.listTagsOperation);
export const createApiTag = contentApiRoute(operations.createTagOperation);
export const getApiTag = contentApiRoute(operations.getTagOperation);
export const updateApiTag = contentApiRoute(operations.updateTagOperation);
export const deleteApiTag = contentApiRoute(operations.deleteTagOperation);
