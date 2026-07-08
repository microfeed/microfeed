const {createMigratedInMemoryDatabase} = require("../../../../test-utils/d1-substitute");
import ItemRepo from "../../../../edge-src/models/ItemRepo";
import ContentService from "../../../../edge-src/models/ContentService";
import {STATUSES} from "../../../../common-src/Constants";

import {onRequestPost as createItem, onRequestGet as listItems} from "./index.jsx";
import {onRequestPut as updateItem, onRequestDelete as deleteItem} from "./[itemId]/index.jsx";

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
  return new Request("https://site.test/admin/ajax/items", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
}

describe("admin items ajax handlers", () => {
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

  test("POST create with missing content_type returns 400 content_type error", async () => {
    const db = createMigratedInMemoryDatabase();
    const {data} = makeData(db);

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
    } finally {
      db.close();
    }
  });

  test("POST create with missing required title returns 400 errors and writes nothing", async () => {
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

  test("GET with ?content_type=photo returns 200 with only matching, non-deleted photos", async () => {
    const db = createMigratedInMemoryDatabase();
    const {data} = makeData(db);

    try {
      const photo1Response = await createItem({
        request: jsonRequest({
          content_type: "photo",
          status: "published",
          title: "Photo One",
          image: "https://cdn.example.com/one.jpg",
        }),
        data,
        env: {},
        params: {},
      });
      const {id: photo1Id} = await photo1Response.json();

      const photo2Response = await createItem({
        request: jsonRequest({
          content_type: "photo",
          status: "published",
          title: "Photo Two",
          image: "https://cdn.example.com/two.jpg",
        }),
        data,
        env: {},
        params: {},
      });
      const {id: photo2Id} = await photo2Response.json();

      await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "Not A Photo",
          content_html: "<p>Body</p>",
        }),
        data,
        env: {},
        params: {},
      });

      const request = new Request("https://site.test/admin/ajax/items?content_type=photo", {
        method: "GET",
      });
      const response = await listItems({request, data, env: {}, params: {}});
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.items).toHaveLength(2);
      const ids = body.items.map((item) => item.id);
      expect(ids.sort()).toEqual([photo1Id, photo2Id].sort());
      body.items.forEach((item) => {
        expect(item.content_type).toBe("photo");
      });
    } finally {
      db.close();
    }
  });

  test("GET with ?content_type__in=photo,blog_article returns both types", async () => {
    const db = createMigratedInMemoryDatabase();
    const {data} = makeData(db);

    try {
      const photoResponse = await createItem({
        request: jsonRequest({
          content_type: "photo",
          status: "published",
          title: "Photo One",
          image: "https://cdn.example.com/one.jpg",
        }),
        data,
        env: {},
        params: {},
      });
      const {id: photoId} = await photoResponse.json();

      const articleResponse = await createItem({
        request: jsonRequest({
          content_type: "blog_article",
          status: "published",
          title: "Article One",
          content_html: "<p>Body</p>",
        }),
        data,
        env: {},
        params: {},
      });
      const {id: articleId} = await articleResponse.json();

      const request = new Request("https://site.test/admin/ajax/items?content_type__in=photo,blog_article", {
        method: "GET",
      });
      const response = await listItems({request, data, env: {}, params: {}});
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.items).toHaveLength(2);
      expect(body.items.map((item) => item.id).sort()).toEqual([photoId, articleId].sort());
      expect(body.items.map((item) => item.content_type).sort()).toEqual(["blog_article", "photo"]);
    } finally {
      db.close();
    }
  });
});
