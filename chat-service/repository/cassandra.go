package repository

import (
    "fmt"
    "log"
    "strings"
    "time"

    "github.com/gocql/gocql"
    "github.com/yourorg/chat-service/config"
    "github.com/yourorg/chat-service/models"
)

var Session *gocql.Session

func InitCassandra() {
    // Разбираем строку хостов (можно передать "cassandra1,cassandra2")
    hosts := strings.Split(config.CassandraHost, ",")

    // 1) Системная сессия (keyspace не указываем)
    sysCluster := gocql.NewCluster(hosts...)
    sysCluster.Consistency = gocql.One
    sysCluster.Timeout = 10 * time.Second

    var sysSess *gocql.Session
    var err error
    // retry, пока кластер не станет доступен
    for i := 1; i <= 10; i++ {
        sysSess, err = sysCluster.CreateSession()
        if err == nil {
            break
        }
        log.Printf("Cassandra(system) не доступен, попытка %d/10: %v", i, err)
        time.Sleep(2 * time.Second)
    }
    if err != nil {
        log.Fatalf("Не удалось подключиться к Cassandra (system): %v", err)
    }
    defer sysSess.Close()

    // 2) Создаём keyspace, если нет
    cqlKS := fmt.Sprintf(`
        CREATE KEYSPACE IF NOT EXISTS %s 
        WITH replication = {'class':'SimpleStrategy','replication_factor':3};
    `, config.CassandraKeyspace)
    if err := sysSess.Query(cqlKS).Exec(); err != nil {
        log.Fatalf("Не удалось создать keyspace %s: %v", config.CassandraKeyspace, err)
    }

    // 3) Теперь рабочая сессия в вашем keyspace
    cluster := gocql.NewCluster(hosts...)
    cluster.Keyspace = config.CassandraKeyspace
    cluster.Consistency = gocql.One
    cluster.Timeout = 10 * time.Second

    for i := 1; i <= 10; i++ {
        Session, err = cluster.CreateSession()
        if err == nil {
            break
        }
        log.Printf("Cassandra(%s) не доступен, попытка %d/10: %v", config.CassandraKeyspace, i, err)
        time.Sleep(2 * time.Second)
    }
    if err != nil {
        log.Fatalf("Не удалось подключиться к Cassandra(%s): %v", config.CassandraKeyspace, err)
    }

    // 4) Создаём таблицу сообщений (полное имя через keyspace)
    cqlTbl := fmt.Sprintf(`
        CREATE TABLE IF NOT EXISTS %s.messages (
            channel_id uuid,
            created_at timestamp,
            message_id uuid,
            sender_id text,
            content text,
            PRIMARY KEY ((channel_id), created_at, message_id)
        ) WITH CLUSTERING ORDER BY (created_at DESC);
    `, config.CassandraKeyspace)
    if err := Session.Query(cqlTbl).Exec(); err != nil {
        log.Fatalf("Не удалось создать таблицу messages: %v", err)
    }

    log.Println("Cassandra инициализирована: keyspace и таблица готовы")
}

func SaveMessage(m *models.Message) error {
    cql := fmt.Sprintf(`INSERT INTO %s.messages
        (channel_id, created_at, message_id, sender_id, content)
        VALUES (?, ?, ?, ?, ?)`, config.CassandraKeyspace)
    return Session.Query(cql,
        m.ChannelID, m.CreatedAt, m.MessageID, m.SenderID, m.Content,
    ).Exec()
}

func GetMessages(channelID string, limit int, after time.Time) ([]models.Message, error) {
    var msgs []models.Message

    cid, err := gocql.ParseUUID(channelID)
    if err != nil {
        return nil, fmt.Errorf("invalid channelID: %w", err)
    }

    // Собираем CQL и аргументы
    cql := fmt.Sprintf(`SELECT channel_id, created_at, message_id, sender_id, content 
        FROM %s.messages WHERE channel_id = ?`, config.CassandraKeyspace)
    args := []interface{}{cid}
    if !after.IsZero() {
        cql += " AND created_at < ?"
        args = append(args, after)
    }

    q := Session.Query(cql, args...)
    if limit > 0 {
        q = q.PageSize(limit)
    }

    iter := q.Iter()
    var m models.Message
    for iter.Scan(&m.ChannelID, &m.CreatedAt, &m.MessageID, &m.SenderID, &m.Content) {
        msgs = append(msgs, m)
    }
    if err := iter.Close(); err != nil {
        return nil, err
    }
    return msgs, nil
}
