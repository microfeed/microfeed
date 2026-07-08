const {createMigratedInMemoryDatabase} = require("../../../test-utils/d1-substitute");
import ItemRepo from "../../../edge-src/models/ItemRepo";
import ContentService from "../../../edge-src/models/ContentService";
import {STATUSES} from "../../../common-src/Constants";

import {onRequestPost as createItem} from "./index.jsx";
import {onRequestPut as updateItem, onRequestDelete as deleteItem} from "./[itemId]/index.jsx";
import {onRequestPost as restoreItem} from "./[itemId]/restore/index.jsx";
import {onRequestPost as purgeItem} from "./[itemId]/purge/index.jsx";
import {onRequestPost as bulkAction} from "./bulk/index.jsx";

function makeData(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    data: {
      feedCrud: new ContentService({}, {itemRepo}, {url: "https://example.com/"}),
    },
  };
}

function jsonRequest(body) {
  return new Request("https://example.com/api/items", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
}

describe("items API handlers", () => {
  test("POST create valid blog_article returns 201 with id and persists the row", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const request = jsonRequest({
        content_type: "blog_article",
        status: "published",
        title: "Hello World",
        content_html: "<p>Body</p>",
      });

      const response = await createItem({request, data, env: {}, params: {}});
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(typeof body.id).toBe("string");

      const row = await itemRepo.getById(body.id);
      expect(row).toMatchObject({
        id: body.id,
        content_type: "blog_article",
        slug: "hello-world",
      });
    } finally {
      db.close();
    }
  });

  test("POST create with missing title returns 400 with errors and writes nothing", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const request = jsonRequest({
        content_type: "blog_article",
        status: "published",
        title: "",
        content_html: "<p>Body</p>",
      });

      const response = await createItem({request, data, env: {}, params: {}});
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "title"})]),
      );

      expect((await itemRepo.list()).results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("POST create with missing content_type returns 400 content_type error", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const request = jsonRequest({
        status: "published",
        title: "No Type",
        content_html: "<p>Body</p>",
      });

      const response = await createItem({request, data, env: {}, params: {}});
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "content_type"})]),
      );

      expect((await itemRepo.list()).results).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("POST create with unknown content_type returns 400 content_type error", async () => {
    const db = createMigratedInMemoryDatabase();
    const {data} = makeData(db);

    try {
      const request = jsonRequest({
        content_type: "not_a_real_type",
        status: "published",
        title: "Bad Type",
        content_html: "<p>Body</p>",
      });

      const response = await createItem({request, data, env: {}, params: {}});
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "content_type"})]),
      );
    } finally {
      db.close();
    }
  });

  test("PUT update existing item returns 200; invalid update returns 400", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const createResponse = await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "Original Title",
          content_html: "<p>Original</p>",
        }),
        data,
        env: {},
        params: {},
      });
      const {id} = await createResponse.json();

      const updateResponse = await updateItem({
        request: jsonRequest({excerpt: "Updated teaser"}),
        data,
        env: {},
        params: {itemId: id},
      });
      expect(updateResponse.status).toBe(200);
      const updateBody = await updateResponse.json();
      expect(updateBody.id).toBe(id);

      const row = await itemRepo.getById(id);
      expect(JSON.parse(row.data)).toMatchObject({excerpt: "Updated teaser"});

      const invalidResponse = await updateItem({
        request: jsonRequest({title: ""}),
        data,
        env: {},
        params: {itemId: id},
      });
      expect(invalidResponse.status).toBe(400);
      const invalidBody = await invalidResponse.json();
      expect(invalidBody.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "title"})]),
      );
    } finally {
      db.close();
    }
  });

  test("DELETE existing item returns 200 and status becomes DELETED; missing returns 404", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const createResponse = await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "To Delete",
          content_html: "<p>Body</p>",
        }),
        data,
        env: {},
        params: {},
      });
      const {id} = await createResponse.json();

      const deleteResponse = await deleteItem({params: {itemId: id}, data, request: undefined, env: {}});
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      expect(deleteBody.id).toBe(id);

      const row = await itemRepo.getById(id);
      expect(row.status).toBe(STATUSES.DELETED);

      const missingResponse = await deleteItem({params: {itemId: "does-not-exist"}, data, request: undefined, env: {}});
      expect(missingResponse.status).toBe(404);
    } finally {
      db.close();
    }
  });

  test("POST restore a soft-deleted item returns 200 and status becomes UNPUBLISHED", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const createResponse = await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "To Restore",
          content_html: "<p>Body</p>",
        }),
        data,
        env: {},
        params: {},
      });
      const {id} = await createResponse.json();

      await deleteItem({params: {itemId: id}, data, request: undefined, env: {}});

      const restoreResponse = await restoreItem({params: {itemId: id}, data, env: {}});
      expect(restoreResponse.status).toBe(200);
      const restoreBody = await restoreResponse.json();
      expect(restoreBody.id).toBe(id);

      const row = await itemRepo.getById(id);
      expect(row.status).toBe(STATUSES.UNPUBLISHED);
    } finally {
      db.close();
    }
  });

  test("POST purge a soft-deleted item returns 200 and removes the row", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const createResponse = await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "To Purge",
          content_html: "<p>Body</p>",
        }),
        data,
        env: {},
        params: {},
      });
      const {id} = await createResponse.json();

      await deleteItem({params: {itemId: id}, data, request: undefined, env: {}});

      const purgeResponse = await purgeItem({
        request: new Request("https://example.com/", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({}),
        }),
        data,
        env: {},
        params: {itemId: id},
      });
      expect(purgeResponse.status).toBe(200);
      const purgeBody = await purgeResponse.json();
      expect(purgeBody.id).toBe(id);

      const row = await itemRepo.getById(id);
      expect(row).toBeFalsy();
    } finally {
      db.close();
    }
  });

  test("POST bulk publish returns 200 with succeeded/skipped; unknown action returns 400", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const idA = (await (await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "unpublished",
          title: "Bulk A",
          content_html: "<p>A</p>",
        }),
        data,
        env: {},
        params: {},
      })).json()).id;
      const idB = (await (await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "unpublished",
          title: "Bulk B",
          content_html: "<p>B</p>",
        }),
        data,
        env: {},
        params: {},
      })).json()).id;

      const bulkResponse = await bulkAction({
        request: jsonRequest({action: "publish", ids: [idA, idB, "missing"]}),
        data,
        env: {},
        params: {},
      });
      expect(bulkResponse.status).toBe(200);
      const bulkBody = await bulkResponse.json();
      expect(bulkBody.succeeded.slice().sort()).toEqual([idA, idB].sort());
      expect(bulkBody.skipped).toEqual([{id: "missing", reason: "not found"}]);

      const rowA = await itemRepo.getById(idA);
      const rowB = await itemRepo.getById(idB);
      expect(rowA.status).toBe(STATUSES.PUBLISHED);
      expect(rowB.status).toBe(STATUSES.PUBLISHED);

      const unknownActionResponse = await bulkAction({
        request: jsonRequest({action: "not_a_real_action", ids: [idA]}),
        data,
        env: {},
        params: {},
      });
      expect(unknownActionResponse.status).toBe(400);
      const unknownActionBody = await unknownActionResponse.json();
      expect(unknownActionBody.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "action"})]),
      );
    } finally {
      db.close();
    }
  });
});
