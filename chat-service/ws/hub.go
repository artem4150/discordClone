package ws

import "sync"

// Hub хранит подписки по channelID
type Hub struct {
    mu       sync.RWMutex
    channels map[string]map[*Client]bool
}

func NewHub() *Hub {
    return &Hub{
        channels: make(map[string]map[*Client]bool),
    }
}

func (h *Hub) Register(channelID string, c *Client) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if h.channels[channelID] == nil {
        h.channels[channelID] = make(map[*Client]bool)
    }
    h.channels[channelID][c] = true
}

func (h *Hub) Unregister(channelID string, c *Client) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if clients, ok := h.channels[channelID]; ok {
        delete(clients, c)
        if len(clients) == 0 {
            delete(h.channels, channelID)
        }
    }
}

func (h *Hub) Broadcast(channelID string, message []byte) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    for c := range h.channels[channelID] {
        c.Send <- message
    }
}
