import {ADMIN_URLS} from "../../../common-src/StringUtils";

export async function onRequestGet() {
  const response = new Response(
    `<html><title>Logout</title><body>Logged out. <a href="${ADMIN_URLS.home()}">Login again?</a></body></html>`,
    {
      status: 401,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  const newResponse = new Response(response.body, response)
  newResponse.headers.set("Set-Cookie", '');
  return newResponse;
}
