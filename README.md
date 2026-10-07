# Paseos con True 🐾

Frontend estático (`public/`) + funciones serverless (`api/`) + Redis gratuito (Upstash).

## Probar en local
```
npm run dev      # http://localhost:3000 (datos en memoria, se pierden al reiniciar)
node test/api.test.js
```

## Desplegar en Vercel (gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En vercel.com → *Add New Project* → importa el repo (sin framework, sin build).
3. En el proyecto: **Storage → Create Database → Upstash Redis (Free)** y conéctalo al proyecto. Esto crea automáticamente las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. *Redeploy*. Listo: todos los usuarios comparten la misma bitácora.

## Notas
- Las contraseñas se guardan con hash (scrypt + sal); las sesiones duran 30 días.
- Las reservas usan `HSETNX` (atómico): si dos personas hacen clic a la vez, solo una gana.
- Los teléfonos no se exponen a otros usuarios; la dirección de hospedaje solo la ve su titular.
