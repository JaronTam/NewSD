# syntax=docker/dockerfile:1
# Story 1a.1 sub-PR #4 (AC L276): multi-stage build → single binary.
# Stage 1 builds the frontend dist (TanStack Start SPA), Stage 2 embeds it
# into the Go binary via go:embed. The runtime stage carries only the binary
# (dist is baked in). AD-18: single-node cloud hosting, minimal image.
#
# TODO 1b.1: add a Rust→wasm-pack stage (build .wasm, wire into the frontend
# bundle) — not built in 1a.1 (no wasm consumed yet).

# ---------- Stage 1: frontend (bun → dist/) ----------
FROM oven/bun:1.2 AS frontend
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
# → dist/client (static assets) + dist/server (prerender, build-time only)

# ---------- Stage 2: Go build (embed dist → binary) ----------
FROM golang:1.24 AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY main.go ./
COPY internal/ ./internal/
COPY --from=frontend /app/dist ./dist
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-X github.com/jarontam/newsd/internal/version.Version=${VERSION}" \
    -o /newsd .

# ---------- Stage 3: runtime (binary only) ----------
# alpine (not distroless) for shell + apk — friendlier for VPS debug (AD-18
# deploy target TBD). Final image ~10-15MB; dist baked in, no dist files needed.
FROM alpine:3.20
COPY --from=builder /newsd /newsd
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/newsd"]
