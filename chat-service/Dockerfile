# builder
FROM golang:1.23-alpine AS builder
WORKDIR /app
# модули
COPY go.mod go.sum ./
RUN go mod download
# исходники
COPY . .
RUN go build -o chat-service ./main.go

# runtime
FROM alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/chat-service .
EXPOSE 8080
CMD ["./chat-service"]
