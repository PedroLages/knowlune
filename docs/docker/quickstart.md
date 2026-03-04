# Docker Quick Start

Fast reference for the most common Docker commands for this project.

## Development (Hot Reload)

```bash
# Start development server
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop
docker-compose -f docker-compose.dev.yml down

# Rebuild
docker-compose -f docker-compose.dev.yml up --build

# Clean rebuild (no cache)
docker-compose -f docker-compose.dev.yml build --no-cache && docker-compose -f docker-compose.dev.yml up
```

**Access**: http://localhost:5173

## Production

```bash
# Build image
docker build -t levelup .

# Run container
docker run -d --name levelup-prod -p 8080:80 levelup

# Stop and remove
docker stop levelup-prod && docker rm levelup-prod

# View logs
docker logs -f levelup-prod
```

**Access**: http://localhost:8080

## Debugging

```bash
# Shell into running dev container
docker-compose -f docker-compose.dev.yml exec app sh

# Run commands in container
docker-compose -f docker-compose.dev.yml exec app npm run lint
docker-compose -f docker-compose.dev.yml exec app npm test

# Check container status
docker ps

# Inspect container
docker inspect levelup-dev
```

## Cleanup

```bash
# Remove all containers
docker-compose -f docker-compose.dev.yml down -v

# Remove all images
docker rmi levelup

# Clean Docker system
docker system prune -a
```

See [DOCKER.md](DOCKER.md) for detailed documentation.
