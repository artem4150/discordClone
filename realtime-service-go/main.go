// realtime-service-go/main.go
package main

import (
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/IBM/sarama"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Хранилище соединений по комнатам
var rooms = struct {
	sync.RWMutex
	m map[string]map[*websocket.Conn]bool
}{m: make(map[string]map[*websocket.Conn]bool)}

func main() {
	kafkaAddr := os.Getenv("KAFKA_BROKER") // e.g. "kafka:9092"

	// Retry при создании Kafka-консьюмера
	var consumer sarama.Consumer
	var err error
	for i := 0; i < 10; i++ {
		consumer, err = sarama.NewConsumer([]string{kafkaAddr}, nil)
		if err == nil {
			break
		}
		log.Printf("Kafka consumer connection attempt %d failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		log.Fatalf("Kafka never became available: %v", err)
	}
	defer consumer.Close()

	// Создаём партиционный консьюмер
	partitionConsumer, err := consumer.ConsumePartition("chat", 0, sarama.OffsetNewest)
	if err != nil {
		log.Fatalf("Partition consumer error: %v", err)
	}
	defer partitionConsumer.Close()

	// Обработка входящих WS-клиентов
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3001")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		serverId := r.URL.Query().Get("serverId")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		rooms.Lock()
		if rooms.m[serverId] == nil {
			rooms.m[serverId] = make(map[*websocket.Conn]bool)
		}
		rooms.m[serverId][conn] = true
		rooms.Unlock()

		// Clean up on disconnect
		go func() {
			defer conn.Close()
			for {
				if _, _, err := conn.NextReader(); err != nil {
					rooms.Lock()
					delete(rooms.m[serverId], conn)
					rooms.Unlock()
					return
				}
			}
		}()
	})

	// Горутина чтения из Kafka и рассылки
	go func() {
		for msg := range partitionConsumer.Messages() {
			rooms.RLock()
			conns := rooms.m[string(msg.Key)]
			rooms.RUnlock()

			for conn := range conns {
				if err := conn.WriteMessage(websocket.TextMessage, msg.Value); err != nil {
					rooms.Lock()
					delete(conns, conn)
					rooms.Unlock()
					conn.Close()
				}
			}
		}
	}()

	log.Println("Realtime service listening on :3001")
	log.Fatal(http.ListenAndServe(":3001", nil))
}
