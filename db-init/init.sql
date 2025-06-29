-- db-init/init.sql

-- Подключаемся к postgres, чтобы команды CREATE DATABASE выполнялись в правильном контексте
\connect postgres

-- Если authdb не существует, создаём
SELECT 'CREATE DATABASE authdb'
  WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'authdb'
  );
\gexec

-- Если serversdb не существует, создаём
SELECT 'CREATE DATABASE serversdb'
  WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'serversdb'
  );
\gexec

-- Если channeldb не существует, создаём
SELECT 'CREATE DATABASE channeldb'
  WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'channeldb'
  );
\gexec
