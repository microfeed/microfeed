export type DatabaseMutationCommit<Result> = (
  statements: D1PreparedStatement[],
  result: Result,
) => Promise<void>;

export async function commitDatabaseMutation<Result>(
  database: D1Database,
  statements: D1PreparedStatement[],
  result: Result,
  commit?: DatabaseMutationCommit<Result>,
): Promise<void> {
  if (commit) {
    await commit(statements, result);
    return;
  }
  await database.batch(statements);
}
