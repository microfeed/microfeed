import {characterSearchStatements} from "@/shared/CharacterSearch";

export function characterIndexStatements(
  database: D1Database,
  type: "item" | "page",
  id: string,
  title: string,
  contentText: string,
): D1PreparedStatement[] {
  return characterSearchStatements(type, id, title, contentText).map(
    ({sql, bindings}) => database.prepare(sql).bind(...bindings),
  );
}
