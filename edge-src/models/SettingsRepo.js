import BaseRepo from "./BaseRepo";

const SETTINGS_COLUMNS = [
  "category",
  "data",
  "created_at",
  "updated_at",
];

export default class SettingsRepo extends BaseRepo {
  constructor(db) {
    super(db, {
      table: "settings",
      primaryKey: "category",
      allowedColumns: SETTINGS_COLUMNS,
    });
  }

  async listAll() {
    return this.list({
      orderBy: ["category"],
    });
  }
}

export {SETTINGS_COLUMNS};
