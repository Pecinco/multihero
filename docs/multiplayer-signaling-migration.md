# Señalización backend y migración gradual (escala / fiabilidad)

Este documento describe opciones cuando el multijugador basado en **PeerJS** y el broker público dejen de ser suficientes por **escala**, **fiabilidad predecible** o **requisitos de producto** (cuentas, salas globales, moderación). No sustituye el endurecimiento en cliente ni un PeerServer + TURN propios (plan “A”); es el siguiente escalón (plan “B” del documento de arquitectura).

## Estado actual (referencia)

- **Identidad**: `peerId` corto en perfil; PeerJS usa `PEER_PREFIX + peerId` como ID completo (`src/hooks/useMultiplayer.ts`).
- **Descubrimiento / broker**: por defecto cloud de PeerJS (`new Peer(...)` sin `host`/`port`/`path`).
- **Canal de aplicación**: mensajes tipados (`MultiplayerMessage`: amigos, batallas, `SYNC_PROGRESS`, etc.) sobre **DataConnection** WebRTC gestionado por PeerJS.

Las migraciones siguientes asumen que **el modelo de mensajes de aplicación puede mantenerse**; solo cambia **cómo** los clientes se encuentran y entregan señales o datos.

## Cuándo plantear esta migración

Considera diseñar/implementar señalización propia o Firebase cuando aparezcan varias de estas señales:

- Necesitas **SLA**, cuotas conocidas o **auditoría** de conexiones.
- **Matchmaking** global, salas nombradas o listas de partidas visibles para extraños.
- **Moderación**, reportes o bloqueo centralizado de IDs.
- El broker público o redes de usuarios generan **demasiados fallos** pese a TURN/PeerServer propios.
- Quieres **historial** de partidas o presencia (“en línea”) sin depender de que dos peers estén conectados al mismo tiempo.

Si solo necesitas fiabilidad entre amigos con código, suele bastar **PeerServer propio + Coturn** antes que reescribir la capa de señalización.

## Opción 1: WebSocket propio (servidor tuyo)

### Rol del servidor

- **Señalización WebRTC**: intercambiar SDP/ICE entre participantes (sustituye al broker PeerJS para el handshake). Los datos de partida pueden seguir en **RTCDataChannel** con la misma semántica que hoy.
- **Canal de aplicación alternativo**: en lugar de WebRTC, enviar **todos** los mensajes de juego por WebSocket (más simple operativamente, más latencia y coste de ancho de banda en el servidor).

### Componentes típicos

- Servicio **WS** con autenticación (token JWT, sesión de juego, etc.).
- Registro de **salas** (por código, por matchmaking): quién está en cada sala, a quién reenviar cada mensaje.
- Opcional: **Redis** u otro pub/sub si escalas horizontalmente el servicio WS.
- **Coturn** sigue siendo recomendable para NAT/firewalls agresivos; el WS no sustituye TURN.

### Ventajas

- Control total de **lógica**, límites, logs y despliegue (VPC, región, etc.).
- Coste predecible si ya tienes backend.

### Inconvenientes

- Operación, seguridad (rate limiting, DoS), y mantenimiento del servicio.

## Opción 2: Firebase (Realtime Database o Firestore)

### Patrón habitual

- **Salas** como documentos o nodos: participantes escriben su oferta/respuesta SDP o mensajes cortos de señalización en subcolecciones/nodos acordados.
- **Presencia** con `onDisconnect` en Realtime Database, o extensiones de presencia sobre Firestore (más trabajo).
- Reglas de seguridad para que solo los miembros de una sala lean/escriban sus señales.

### Ventajas

- Infraestructura gestionada, buena para **prototipos rápidos** y apps móviles sin servidor propio.
- Escalado de lecturas/escrituras bajo el modelo de Firebase.

### Inconvenientes

- Coste según uso; reglas y modelos de datos deben **evitar lecturas globales** costosas.
- Menos flexibilidad que un WS custom para lógica compleja de matchmaking o anti-fraude.

### Elección dentro de Firebase

- **Realtime Database**: latencia baja en árboles pequeños, ideal para señales efímeras si el diseño del árbol es estricto.
- **Firestore**: mejor si ya usas documentos/colecciones y quieres consultas más ricas; las señales suelen ir en subcolecciones por `roomId` con TTL o borrado tras conectar.

## Comparativa breve

| Criterio | WebSocket propio | Firebase |
|----------|-------------------|----------|
| Control operativo | Alto | Medio (plataforma gestionada) |
| Tiempo hasta MVP señalización | Mayor (servidor + despliegue) | Menor si el equipo ya usa Firebase |
| Coste fijo vs variable | Depende de tu hosting | Uso y lecturas/escrituras |
| Matchmaking complejo | Natural en un solo lugar | Posible pero más constraints en queries |
| Dependencia de terceros | Tu infra | Google |

## Migración gradual (recomendada)

La idea es **no** reescribir todo el juego en un solo paso.

### Fase 0 — Baseline

- Mantener PeerJS mientras defines métricas: tasa de fallo de conexión, tiempo hasta primer `DataConnection` abierto, etc.

### Fase 1 — Capa de transporte abstracta (solo diseño / refactor interno)

- Introducir una interfaz del estilo `SignalingTransport` + `GameChannel` en el cliente, donde hoy acoplas PeerJS directamente a los manejadores de `MultiplayerMessage`.
- Objetivo: poder enchufar **otro** backend sin tocar la UI ni el modelo de `UserState` de golpe.

### Fase 2 — Señalización híbrida o paralela

- **Modo A (híbrido WebRTC)**: Firebase o WS solo intercambia SDP/ICE; una vez establecido el canal, reutilizas la misma serialización de mensajes que ya envías por `DataConnection`.
- **Modo B (paralelo para pruebas)**: feature flag o “beta”: un subconjunto de usuarios usa el nuevo transporte para **solo** presencia o invitaciones, y PeerJS para datos hasta validar.

### Fase 3 — Tráfico de partida

- Desplazar `BATTLE_*` y, si procede, sincronización de batalla al canal elegido (WebRTC vía nueva señalización, o WS puro).
- Mantener compatibilidad temporal: por ejemplo, aceptar invitaciones por ambos caminos durante una versión.

### Fase 4 — Limpieza

- Retirar dependencia del broker PeerJS público o de PeerJS por completo si pasaste todo a WS.
- Documentar límites de sala, retención de datos de señalización y privacidad (GDPR / menores).

## Criterio de elección práctico

- **Ya tienes o planeas backend Node/Go/etc.** con usuarios autenticados → prioriza **WebSocket** en tu dominio, Coturn para ICE, y opcionalmente conservar WebRTC solo para datos.
- **Sin servidor propio** y necesidad de salas/presencia rápida → **Firebase** como capa de señalización y presencia; evalúa coste con pruebas de carga realistas sobre el esquema de salas.

## Referencias en código

- Inicialización PeerJS y prefijos: `src/hooks/useMultiplayer.ts`.
- Utilidades de ID: `src/lib/multiplayerUtils.ts`.

Este documento es estable como guía de diseño; los detalles de implementación (librerías WS, esquema exacto de Firestore) deben fijarse al abrir el proyecto de migración.
