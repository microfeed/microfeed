BEGIN TRANSACTION;

INSERT INTO table_that_does_not_exist (id)
VALUES ('migration-must-fail');

COMMIT;
