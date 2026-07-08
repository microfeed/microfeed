const {createMigratedInMemoryDatabase} = require("../../../../test-utils/d1-substitute");

import {onRequestGet as listTags, onRequestPost as createTag} from "./index.jsx";
import {onRequestPut as renameTag, onRequestDelete as deleteTag} from "./[tagId]/index.jsx";

function jsonRequest(body, method = "POST") {
  return new Request("https://site.test/admin/ajax/tags", {
    method,
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
}

describe("admin tags ajax handlers", () => {
  test("GET returns 200 with the list of tags", async () => {
    const db = createMigratedInMemoryDatabase();
    const env = {FEED_DB: db};

    try {
      await createTag({request: jsonRequest({name: "Cooking"}), env, params: {}});
      await createTag({request: jsonRequest({name: "Travel"}), env, params: {}});

      const response = await listTags({env, params: {}});
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.tags).toHaveLength(2);
      expect(body.tags.map((t) => t.name).sort()).toEqual(["Cooking", "Travel"]);
    } finally {
      db.close();
    }
  });

  test("POST create returns 201 with the created tag", async () => {
    const db = createMigratedInMemoryDatabase();
    const env = {FEED_DB: db};

    try {
      const response = await createTag({request: jsonRequest({name: "Music"}), env, params: {}});
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.tag).toMatchObject({name: "Music", slug: "music"});
      expect(typeof body.tag.id).toBe("string");
    } finally {
      db.close();
    }
  });

  test("POST create with a duplicate slug returns 400 with errors", async () => {
    const db = createMigratedInMemoryDatabase();
    const env = {FEED_DB: db};

    try {
      await createTag({request: jsonRequest({name: "News"}), env, params: {}});
      const response = await createTag({request: jsonRequest({name: "News"}), env, params: {}});
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "slug"})]),
      );
    } finally {
      db.close();
    }
  });

  test("PUT rename returns 200 with the updated tag; missing id returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    const env = {FEED_DB: db};

    try {
      const createResponse = await createTag({request: jsonRequest({name: "Old Name"}), env, params: {}});
      const {tag} = await createResponse.json();

      const renameResponse = await renameTag({
        request: jsonRequest({name: "New Name"}, "PUT"),
        env,
        params: {tagId: tag.id},
      });
      expect(renameResponse.status).toBe(200);
      const renameBody = await renameResponse.json();
      expect(renameBody.tag).toMatchObject({id: tag.id, name: "New Name", slug: "new-name"});

      const missingResponse = await renameTag({
        request: jsonRequest({name: "Nope"}, "PUT"),
        env,
        params: {tagId: "does-not-exist"},
      });
      expect(missingResponse.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("DELETE existing tag returns 200 and removes it; missing returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    const env = {FEED_DB: db};

    try {
      const createResponse = await createTag({request: jsonRequest({name: "To Delete"}), env, params: {}});
      const {tag} = await createResponse.json();

      const deleteResponse = await deleteTag({env, params: {tagId: tag.id}});
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      expect(deleteBody.id).toBe(tag.id);

      const listResponse = await listTags({env, params: {}});
      const listBody = await listResponse.json();
      expect(listBody.tags.find((t) => t.id === tag.id)).toBeUndefined();

      const missingResponse = await deleteTag({env, params: {tagId: "does-not-exist"}});
      expect(missingResponse.status).toBe(404);
    } finally {
      db.close();
    }
  });
});
