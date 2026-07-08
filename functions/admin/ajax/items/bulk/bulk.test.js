const {createMigratedInMemoryDatabase} = require("../../../../../test-utils/d1-substitute");
import ItemRepo from "../../../../../edge-src/models/ItemRepo";
import ContentService from "../../../../../edge-src/models/ContentService";
import {STATUSES} from "../../../../../common-src/Constants";

import {onRequestPost as createItem} from "../index.jsx";
import {onRequestPost as bulkAction} from "./index.jsx";

function makeData(db) {
  const itemRepo = new ItemRepo(db);
  return {
    itemRepo,
    data: {
      feedCrud: new ContentService({}, {itemRepo}, {url: "https://site.test/"}),
    },
  };
}

function jsonRequest(body) {
  return new Request("https://site.test/admin/ajax/items/bulk", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
}

describe("admin items bulk ajax handler", () => {
  test("POST bulk publish returns 200 with succeeded/skipped and updates statuses", async () => {
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

      const response = await bulkAction({
        request: jsonRequest({action: "publish", ids: [idA, idB, "missing"]}),
        data,
        env: {},
        params: {},
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.succeeded.slice().sort()).toEqual([idA, idB].sort());
      expect(body.skipped).toEqual([{id: "missing", reason: "not found"}]);

      const rowA = await itemRepo.getById(idA);
      const rowB = await itemRepo.getById(idB);
      expect(rowA.status).toBe(STATUSES.PUBLISHED);
      expect(rowB.status).toBe(STATUSES.PUBLISHED);
    } finally {
      db.close();
    }
  });

  test("POST bulk unpublish and delete update statuses accordingly", async () => {
    const db = createMigratedInMemoryDatabase();
    const {itemRepo, data} = makeData(db);

    try {
      const idA = (await (await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "Unpub Me",
          content_html: "<p>A</p>",
        }),
        data,
        env: {},
        params: {},
      })).json()).id;
      const idB = (await (await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "Delete Me",
          content_html: "<p>B</p>",
        }),
        data,
        env: {},
        params: {},
      })).json()).id;

      const unpublishResponse = await bulkAction({
        request: jsonRequest({action: "unpublish", ids: [idA]}),
        data,
        env: {},
        params: {},
      });
      expect(unpublishResponse.status).toBe(200);
      const unpublishBody = await unpublishResponse.json();
      expect(unpublishBody.succeeded).toEqual([idA]);
      expect((await itemRepo.getById(idA)).status).toBe(STATUSES.UNPUBLISHED);

      const deleteResponse = await bulkAction({
        request: jsonRequest({action: "delete", ids: [idB]}),
        data,
        env: {},
        params: {},
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      expect(deleteBody.succeeded).toEqual([idB]);
      expect((await itemRepo.getById(idB)).status).toBe(STATUSES.DELETED);
    } finally {
      db.close();
    }
  });

  test("POST bulk with unknown action returns 400 with action field error", async () => {
    const db = createMigratedInMemoryDatabase();
    const {data} = makeData(db);

    try {
      const response = await bulkAction({
        request: jsonRequest({action: "not_a_real_action", ids: ["whatever"]}),
        data,
        env: {},
        params: {},
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field: "action"})]),
      );
    } finally {
      db.close();
    }
  });
});
