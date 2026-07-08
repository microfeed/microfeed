import TagRepo from "./TagRepo";
import {randomShortUUID} from "../../common-src/StringUtils";

const slugify = require("slugify");

function normalizeSlugSource(title) {
  if (title === undefined || title === null) {
    return "";
  }

  const titleText = String(title).trim();
  if (!titleText) {
    return "";
  }

  let slug = slugify(titleText, {
    lower: true,
    strict: true,
  });

  if (!slug) {
    slug = titleText
      .normalize("NFKD")
      .toLowerCase()
      .trim()
      .replace(/['!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/\_/g, "-")
      .replace(/\-\-+/g, "-")
      .replace(/\-$/g, "");
  }

  return slug;
}

function isUniqueConstraintError(error) {
  const message = error?.message || "";
  return /UNIQUE constraint failed/i.test(message);
}

function validationError(field, message) {
  return {
    errors: [
      {
        field,
        message,
      },
    ],
  };
}

export default class TagService {
  constructor(db) {
    this.db = db;
    this.tagRepo = new TagRepo(db);
  }

  async create({name, slug} = {}) {
    if (!name || !String(name).trim()) {
      return validationError("name", "Name is required");
    }

    const slugSource = slug ? normalizeSlugSource(slug) : normalizeSlugSource(name);
    if (!slugSource) {
      return validationError("name", "Unable to derive a slug from the name");
    }

    const existing = await this.tagRepo.getBySlug(slugSource);
    if (existing) {
      return validationError("slug", "Slug already exists");
    }

    const tagId = randomShortUUID();
    const row = {
      id: tagId,
      slug: slugSource,
      name: String(name).trim(),
    };

    try {
      await this.tagRepo.insert(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return validationError("slug", "Slug already exists");
      }
      throw error;
    }

    return this.tagRepo.getById(tagId);
  }

  async rename(id, {name, slug} = {}) {
    const existingRow = await this.tagRepo.getById(id);
    if (!existingRow) {
      return validationError("id", "Tag not found");
    }

    const patch = {};
    if (name !== undefined) {
      if (!name || !String(name).trim()) {
        return validationError("name", "Name is required");
      }
      patch.name = String(name).trim();
    }

    let slugSource;
    if (slug !== undefined) {
      slugSource = normalizeSlugSource(slug);
    } else if (name !== undefined) {
      slugSource = normalizeSlugSource(name);
    }

    if (slugSource !== undefined) {
      if (!slugSource) {
        return validationError("name", "Unable to derive a slug from the name");
      }
      const existingWithSlug = await this.tagRepo.getBySlug(slugSource);
      if (existingWithSlug && existingWithSlug.id !== id) {
        return validationError("slug", "Slug already exists");
      }
      patch.slug = slugSource;
    }

    if (Object.keys(patch).length === 0) {
      return existingRow;
    }

    try {
      await this.tagRepo.update(id, patch);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return validationError("slug", "Slug already exists");
      }
      throw error;
    }

    return this.tagRepo.getById(id);
  }

  async delete(id) {
    const existingRow = await this.tagRepo.getById(id);
    if (!existingRow) {
      return validationError("id", "Tag not found");
    }

    await this.db.batch([
      this.db.prepare("DELETE FROM item_tags WHERE tag_id = ?").bind(id),
      this.tagRepo.buildDeleteStatement(id),
    ]);

    return {id};
  }

  async list() {
    return (await this.tagRepo.list({orderBy: ["name"]})).results;
  }

  async getBySlug(slug) {
    return this.tagRepo.getBySlug(slug);
  }
}
