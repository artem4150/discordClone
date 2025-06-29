# builder
FROM golang:1.23-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o channel-service ./main.go

# runtime
FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/channel-service .
EXPOSE 8080
CMD ["./channel-service"]
