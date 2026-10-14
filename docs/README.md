# Sistema de pedidos para restaurantes

> Nombre comercial por definir · nombre de trabajo `resto`
> Toma de pedidos en el celular, pago verificado con Yallegó antes de cocinar,
> pantalla de cocina y pantalla de pedidos listos para los clientes.

---

## Qué es

Plataforma multi-tenant para restaurantes que cobran antes de cocinar. La cajera
arma el pedido en su celular y el cliente paga con Yape o en efectivo. El sistema
verifica el Yape contra la notificación real del banco, a través de
Yallegó (repositorio aparte), y recién entonces manda el pedido a cocina.
Una pantalla frente a los clientes muestra qué está en preparación y qué está listo.

---

## Documentación

| #   | Documento                                                              | Contenido                                                                                  |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 01  | [Contexto y Análisis](./01_CONTEXTO_Y_ANALISIS.md)                     | Problema, propuesta de valor, relación con Yallegó y sus brechas, decisiones, riesgos      |
| 02  | [Requerimientos Funcionales](./02_REQUERIMIENTOS_FUNCIONALES.md)       | 20 módulos con prioridad, matriz de roles y trazabilidad por sprint                        |
| 03  | [Requerimientos No Funcionales](./03_REQUERIMIENTOS_NO_FUNCIONALES.md) | Rendimiento, disponibilidad, seguridad, privacidad, usabilidad, compatibilidad             |
| 04  | [Arquitectura de Software](./04_ARQUITECTURA_SOFTWARE.md)              | Monolito modular, capa anticorrupción con Yallegó, flujos de cobro, concurrencia, ADRs     |
| 05  | [Modelo de Datos](./05_MODELO_DATOS.md)                                | Diagrama, DDL completo, Row Level Security, semillas, Redis, retención                     |
| 06  | [Contrato de API](./06_API_CONTRACT.md)                                | Endpoints, errores, idempotencia, webhooks entrantes, WebSocket, llamadas a Yallegó        |
| 07  | [Seguridad y Autenticación](./07_SEGURIDAD_AUTH.md)                    | Audiencias, pantallas vinculadas, credenciales de Yallegó, controles contra el fraude      |
| 08  | [Flujos de Experiencia](./08_UX_FLUJOS.md)                             | Caja, cobro con Yape y efectivo, celular de cobros caído, cocina, pantalla pública         |
| 09  | [Sistema de Diseño](./09_DESIGN_SYSTEM.md)                             | Línea gráfica Marino (claro y noche), mascota, color, tipografía, componentes y «con resto» |
| 10  | [Plan de Desarrollo](./10_PLAN_DESARROLLO.md)                          | 8 sprints con tareas y criterios de aceptación; dependencias de Yallegó                    |
| 11  | [Estructura del Proyecto](./11_ESTRUCTURA_PROYECTO.md)                 | Monorepo, módulos, simulador de Yallegó, entorno local, convenciones, variables            |

---

## Arquitectura en una vista

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Caja         │ │ Cocina       │ │ Pantalla     │ │ Administración│
│ (celular)    │ │ (tablet)     │ │ pública (TV) │ │ (web)        │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       └────────────────┴── HTTPS + WSS ─┴────────────────┘
                                │
                    ┌───────────▼───────────┐   REST (clave de API)    ┌───────────┐
                    │  Backend (NestJS)     │ ────────────────────────► │  Yallegó  │
                    │  API · socket · worker│ ◄──────────────────────── │           │
                    └───────────┬───────────┘    webhooks firmados      └─────▲─────┘
                         ┌──────┴──────┐                                      │
                         ▼             ▼                              Celular de cobros
                    PostgreSQL       Redis                            (app Yallegó)
```

---

## Decisiones clave

| Decisión                                                      | Razón                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Proyecto aparte que usa solo la API pública de Yallegó        | El restaurante es el primer integrador real; cada brecha mejora Yallegó     |
| Siempre se cobra antes de cocina                              | Decisión del negocio (D2)                                                   |
| Entrega: la cajera (para llevar) y la mesera (en el local)    | Así trabaja hoy el restaurante piloto (D8)                                  |
| Yape vía Yallegó y efectivo; sin tarjeta                      | Decisión del negocio (D3)                                                   |
| La cajera siempre confirma qué pago corresponde a qué pedido  | Yape no trae número de pedido y los montos se repiten                       |
| Un cobro en un solo pago, garantizado en nuestra base         | No depender de la atomicidad de Yallegó (brecha Y1)                         |
| Constancia solo con el celular de cobros caído, y conciliada  | Mantener la operación sin abrir una vía cómoda para el fraude               |
| Una sola app web instalable para todas las superficies       | Celular, tablet, TV y escritorio con un desarrollo, sin tiendas de apps     |
| Negocio → local con RLS desde el primer sprint                | Multi-tenant y multi-local son la visión del producto                       |

---

## Estado

| Fase                        | Estado                                   |
| --------------------------- | ---------------------------------------- |
| Definición de producto      | ✅ Completa (con decisiones pendientes)  |
| Documentación técnica       | ✅ Completa                              |
| Desarrollo                  | ⏳ Pendiente de inicio (Sprint 1)        |
| Demo para el restaurante    | ⏳ Al cierre del Sprint 5                |
| Piloto en producción        | ⏳ Sprint 8                              |

## Decisiones pendientes

Ver [`01_CONTEXTO_Y_ANALISIS.md` §11](./01_CONTEXTO_Y_ANALISIS.md#11-decisiones-pendientes)
y la línea gráfica en [`09_DESIGN_SYSTEM.md`](./09_DESIGN_SYSTEM.md) (manual `resto_Manual_Marino` en Creative Cloud).

---

## Uso de esta documentación con un agente de codificación

| Tarea                                | Documentos  |
| ------------------------------------ | ----------- |
| Entender el producto                 | 01          |
| Implementar una funcionalidad        | 02, 04, 06  |
| Trabajar con la base de datos        | 05          |
| Autenticación, permisos o Yallegó    | 07, 04 §3.1 y §5 |
| Construir interfaz                   | 08, 09      |
| Configurar el proyecto               | 11          |
| Planificar el trabajo                | 10          |
