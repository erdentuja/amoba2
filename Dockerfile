# Node.js 20 Alpine (kicsi image)
FROM node:20-alpine

# Munkakönyvtár létrehozása
WORKDIR /app

# Package fájlok másolása
COPY package*.json ./

# Dependencies telepítése
RUN npm install --production

# Alkalmazás fájlok másolása
COPY . .

# Port expose
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Szerver indítása
CMD ["node", "server.js"]
