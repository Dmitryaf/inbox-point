FROM node:24.20.0-bookworm-slim AS dependencies

ENV HUSKY=0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS frontend

COPY tsconfig.json ./
COPY frontend ./frontend
RUN npm run build:frontend

FROM eclipse-temurin:25-jdk-noble AS backend
WORKDIR /backend
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
COPY backend/.mvn ./.mvn
COPY backend/mvnw backend/pom.xml ./
COPY backend/src ./src
RUN sh mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:25-jre-noble AS runtime

ENV INBOXPOINT_ENV=production
WORKDIR /app

COPY --from=frontend /app/dist/frontend ./dist/frontend
COPY --from=backend /backend/target/inbox-point-0.0.0-SNAPSHOT.jar ./inbox-point.jar
RUN install -d -m 0700 -o 1000 -g 1000 /app/data

USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["java", "-jar", "/app/inbox-point.jar", "healthcheck"]

CMD ["java", "-jar", "/app/inbox-point.jar"]
