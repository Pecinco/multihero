# Manual completo de usuario - Mates

![Diploma del juego](../public/DIPLOMA.png)

Guía práctica para jugar, progresar más rápido y aprovechar al máximo `MatiCoins`, misiones diarias, héroes e ítems.

---

## 1) Objetivo general del juego

El objetivo es mejorar en multiplicaciones mientras avanzas por el mapa, desbloqueas héroes, consigues estrellas y optimizas tu equipo.

Tus metas principales son:

- Superar niveles del mapa hasta el `nivel 100`.
- Ganar `MatiCoins` para comprar equipamiento.
- Mejorar tu precisión por tabla (el juego guarda historial por operación).
- Completar la misión diaria semanal para premios crecientes.
- Conseguir mejores marcas en los minijuegos bonus.

---

## 2) Pantallas y flujo principal

Flujo recomendado para un jugador nuevo:

1. **Mapa** -> elige nivel normal o nodo bonus.
2. **Batalla / Minijuego** -> responde multiplicaciones.
3. **Victoria** -> cobras monedas y energía.
4. **Tienda/Inventario** -> compras y equipas.
5. **Misión diaria** -> premio extra.

Captura de referencia (héroes):

![Selección de héroes](../public/img/heros/1-Leo.jpg)

---

## 3) Progresión, niveles y recompensas

## Monedas y energía

Cuando ganas en modos con recompensa:

- Recibes `MatiCoins`.
- Recuperas `+10` de energía.

En combate del mapa, si estás en el nivel actual, subes de nivel (`currentLevel`) hasta máximo `100`.

## Estrellas

- **Nodo normal (batalla mapa):** 1 a 3 estrellas según dificultad (`EASY=1`, `NORMAL=2`, `HARD=3`).
- **Nodo bonus runner (cada 10 niveles):** también guarda estrellas.
- **Math Hero bonus:** no usa estrellas; premia por monedas y score.

---

## 4) Funcionamiento de cada minijuego

## A) Batalla del mapa (modo historia)

Mecánica:

- Debes resolver multiplicaciones antes de que el cronómetro llegue a 0.
- Acierto: dañas al monstruo.
- Fallo/tiempo agotado: recibes daño.
- Hay combo, y el combo aumenta daño.

Recompensa base de victoria:

- `50 + combo*5 + nivel*5` (antes de bonus por ítems).

Objetivo:

- Ganar para avanzar mapa y desbloquear contenido.

## B) Batalla rápida

Mecánica:

- Igual que batalla, pero aislada del mapa.
- Rival simulado de nivel fijo.

Recompensa:

- `100` monedas base fijas.

Objetivo:

- Practicar y farmear sin avanzar nodos.

## C) Runner clásico (bonus cada 10 niveles)

Mecánica:

- Carrera de puertas de respuesta.
- Necesitas `15` aciertos para ganar.
- Si fallas, pierdes la partida.
- La barra del monstruo sube con el tiempo.

Recompensa base:

- `100 + floor(nivel*8)`.

Objetivo:

- Ganar monedas rápidas y estrellas en nodos bonus runner.

## D) Math Hero (bonus cada 5 niveles)

Mecánica:

- Runner 3D con 4 carriles, obstáculos y vidas.
- Tienes tiempo inicial variable por nivel del mapa.
- Acierto: suma tiempo, acelera, suma monedas por acierto.
- Fallo: resta vida y tiempo.
- Obstáculo: penaliza tiempo y velocidad.
- Meta completa: `60` aciertos (20 bloques x 3).

Recompensa:

- Monedas = `aciertos * monedasPorAcierto` (escalan con nivel).
- Puedes **doblar premio** con anuncio/reto.

Objetivo:

- Maximizar score y monedas por run.

Captura de ambientación:

![Fondo Math Hero](../public/img/math-hero-space-bg-wide.png)

## E) Minijuego de Tablas (Memory Match)

Mecánica:

- Seleccionas tabla (`1` a `10`).
- Emparejas operación con resultado correcto.
- Formato tipo memory con drag o toque.
- Al completar todas las parejas, ganas.

Recompensas:

- Dinámicas por tabla: más monedas en tablas donde más fallas.
- Tiers aproximados de premio: `200 -> 10`.

Objetivo:

- Reforzar tablas débiles y ganar más en ellas.

## F) Misión diaria - Plataforma

Mecánica:

- Subida de plataformas con `10` rondas.
- Cada fila tiene respuestas; debes caer en la correcta.
- Si fallas o te caes, se reinicia la subida.
- Tiene 2 modos:
  - `daily`: da premio diario.
  - `practice`: solo práctica (sin premio base diario).

Recompensa de misión diaria (racha semanal):

- Lunes a domingo: `100, 150, 250, 400, 600, 800, 1000`.
- Si rompes racha en la semana, vuelve a 100.
- Si ya cobraste hoy, base = 0.

---

## 5) Como conseguir MatiCoins extra

## Vias principales

- Ganar batallas y minijuegos bonus.
- Completar tabla en modo `Tables`.
- Misión diaria semanal.
- Bonus diario de anuncios/reto matemático.
- Doblar premio en runs que lo permiten.
- Bonus por equipamiento con `% de monedas`.
- Vincular cuenta (Google/Apple/Email): `+1000` monedas.

## Bonus diario (hub de mision)

Puedes reclamar hasta `5` bonus al día:

- Secuencia: `100, 150, 200, 250, 300`.
- Tope diario: 5.
- Si tienes compra sin anuncios, se sustituye por reto de multiplicación.

## Doble recompensa de mision diaria

Al completar misión diaria con premio:

- Puedes doblar base (x2) antes de aplicar bonus de ítems.
- Después se aplica `% coinRewardBonus` de equipo.

Formula final:

- `floor(base * (1 o 2) * (1 + bonusMonedas/100))`.

---

## 6) Heroes e items: ventajas y desventajas

## Heroes (avatar)

Los héroes no son solo estéticos: cada bloque de niveles desbloquea stats mayores.

- Niveles bajos (1-10): progresión rápida, daño/vida base.
- Niveles medios: mejor equilibrio para no depender tanto de consumibles.
- Niveles altos: más daño y defensa base.

Ventajas:

- Mejor supervivencia y daño base en batalla.
- Más consistencia en dificultades altas.

Desventajas:

- Requieren progresar en mapa para desbloquear.

Captura de ejemplo:

![Heroe Titan](../public/img/heros/17-Titan.jpg)

## Equipamiento (regla clave)

Solo puedes equipar **1 item por tipo**:

- `ARMOR`, `HELMET`, `PEN`, `POTION`, `HERB`, `PET`.

Si equipas uno de un tipo, reemplaza el anterior del mismo tipo.

## Ventajas por tipo

- **Armor/Helmet:** aumentan vida y reducen daño recibido.
- **Pen:** aumenta daño de respuesta correcta.
- **Potion/Herb:** consumibles de cura o boost temporal (1 uso por combate).
- **Pet:** pasivas fuertes (daño, defensa, monedas, utilidades especiales).

## Desventajas por tipo

- **Armor defensiva:** al priorizar tanqueo, puedes tardar más en cerrar combates si sacrificas daño.
- **Pen ofensivo:** acelera kills, pero si fallas mucho puedes caer por poca mitigación.
- **Consumibles:** se gastan del inventario; hay que recomprar.
- **Mascotas top:** alto coste y desbloqueo tardío.

## Mascotas destacadas

- `Zapp`: elimina una opción incorrecta en combate (muy util para precisión).
- `Luma`: mejora general y otorga una poción aleatoria al ganar.
- `Drako/Pyro`: enfoque ofensivo para runs rápidos.

Captura de referencia (tienda):

![Items de tienda](../public/img/shop/vendor.jpeg)

---

## 7) Estrategia recomendada (practica)

- Prioriza 1 set equilibrado: casco + armadura + pen medio.
- En early game, sube mapa para desbloquear héroes cada 10 niveles.
- Usa `Tables` para subir justo la tabla que más te falla (también paga más).
- Haz misión diaria todos los días para no romper racha semanal.
- Reclama los 5 bonus diarios si necesitas farm de monedas.
- Guarda consumibles para nodos duros o dificultad alta.

---

## 8) Capturas sugeridas para version final PDF

Este manual ya incluye imagenes de recursos del juego.  
Si quieres dejarlo "pro" para familias/alumnos, añade estas capturas in-game:

1. Pantalla de mapa con nodo normal + bonus.
2. Batalla en curso (barra de vida, combo y opciones).
3. Misión diaria (calendario semanal visible).
4. Tienda (comparando stats de 2 items).
5. Inventario con equipo activo.
6. Resultado de Math Hero con score y top.
7. Pantalla multiplayer con modos (`duelo`, `tug`, `sprint`).

---

## 9) Glosario rapido

- **MatiCoins:** moneda principal del juego.
- **Racha diaria:** días seguidos completando misión diaria en la semana.
- **Bonus diario:** premio extra de anuncio/reto (máx 5/día).
- **Stars:** nivel de dominio logrado por nodo según dificultad.
- **Tables mastery:** rendimiento por tabla basado en historial real.

---

Si quieres, te preparo una **version maquetada para imprimir** (PDF estilo revista, con portada, indice y capturas en rejilla).
