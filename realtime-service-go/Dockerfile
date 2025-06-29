# realtime-service-go/Dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o realtime-service

FROM alpine:3.17
RUN apk add --no-cache ca-certificates
WORKDIR /root/
COPY --from=builder /app/realtime-service .
EXPOSE 3001
CMD ["./realtime-service"]
