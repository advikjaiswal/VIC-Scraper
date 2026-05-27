FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 poppler-utils pandoc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev --package-lock=false
COPY . .

ENV PORT=4177
EXPOSE 4177

CMD ["npm", "start"]
