import {redirectApiDocs} from "@/server/api/reference";
import {API_BASE_PATH} from "@/shared/ApiVersion";

export const GET = redirectApiDocs(`${API_BASE_PATH}llms-full.txt`);
export const HEAD = GET;
