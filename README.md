# Proyecto-mama-Ofe
Repositorio oficial para la creación el desarrollo del programa capaz de transpilar pseudocodigo a python/otros lenguajes

# 🧠 CodeFlow — Editor Educativo de Pseudocódigo

CodeFlow es un **editor visual educativo** diseñado para enseñar lógica de programación de forma **segura, guiada y estructurada**, evitando errores comunes del principiante mediante un sistema basado en **AST (Árbol de Sintaxis Abstracta)** y generación de representaciones intermedias (Tokens).

El usuario **no escribe código libremente**: construye programas mediante **bloques lógicos validados semánticamente**, lo que garantiza coherencia, tipado correcto y una experiencia pedagógica sólida.

---

## 🎯 Objetivo del Proyecto

- Enseñar **pensamiento algorítmico**, no sintaxis
- Reducir errores por diseño (UX segura - Poka-yoke)
- Representar programas como un **modelo lógico real**
- Permitir múltiples vistas del mismo programa:
  - Pseudocódigo
  - Diagrama de flujo (futuro)
  - Código Python (futuro)

---

## ⚙️ Funcionalidades Principales (Actualizadas)

### 🧩 Editor de Pseudocódigo
- ✅ Inserción de instrucciones mediante botón `+` (Inserción exacta en cualquier línea)
- ✅ Inserción de líneas vacías explícitas mediante botón `↓`
- ✅ Edición en vivo de instrucciones mediante botón `✎`
- ✅ Menús contextuales por categoría
- ✅ Indentación automática y bloques estructurados (`Si`, `Mientras`, `Para`, `Función`)
- ✅ Selección múltiple, atajos de teclado (`Ctrl+D`, `Ctrl+Z`) y Drag & Drop
- ✅ Eliminación segura de nodos (con protección de llaves huérfanas)

### 📦 Gestión de Variables
- ✅ Declaración explícita desde panel global
- ✅ Tipos estrictos (`number`, `string`, `boolean`, `list`)
- ✅ Inicialización automática segura
- ✅ Uso exclusivo mediante selección en formularios (no texto libre)
- ✅ Registro centralizado de variables con *purga referencial automática* (si borras una variable, se limpia del código)

### 🧠 Funciones
- ✅ Definición de funciones (`def`) con parámetros opcionales y retorno
- ✅ Llamadas a funciones con argumentos
- ✅ Separación visual entre definición y uso
- ✅ Registro central de funciones

### 🔀 Control de Flujo
- ✅ Condicionales (`Si`)
- ✅ Bucles (`Mientras`)
- ✅ Bucles `Para`:
  - ✅ Por rango numérico
  - ✅ Iterativos (sobre variables tipo Array/String)
- ✅ Protección estructural (no se puede sacar un `break` fuera de un bucle)

### ⌨️ Entrada / Salida
- ✅ `Leer` (input)
- ✅ `Mostrar` (Print dinámico combinando múltiples textos y variables)

### 🔄 Generador AST (Preparación para Transpilación)
- ✅ Conversión del AST a JSON estructurado (Tokens)
- 🟡 Transpilación final a Python (Pausada temporalmente para Fase 4)

### 🧱 Arquitectura Interna
- ✅ AST como única fuente de verdad
- ✅ UI como proyección reactiva del modelo
- ✅ Separación estricta de módulos:
  - `app.js`: Cerebro y renderizado (Modelo/Vista)
  - `Validador.js`: Prevención de errores lógicos
  - `ExportadorAST.js`: Exportación a JSON limpio

---

## 🗺️ Fases del Desarrollo del Proyecto

### 🟢 FASE 0 — Definición del Lenguaje
**Estado:** ✅ Completada  
- Palabras clave
- Tipos de datos expansivos (`Num`, `Txt`, `Bool`, `List`)
- Reglas del pseudocódigo y semántica básica

---

### 🟢 FASE 1 — Modelo Lógico (AST)
**Estado:** ✅ Completada  
- AST jerárquico (`root`, `children`, `parentId`)
- Nodos tipados y reemplazo de nodos (`replaceNodeId`)
- Relación padre–hijo (protección contra referencias circulares)
- Inserción y borrado controlado

---

### 🟢 FASE 2 — Editor Visual Seguro
**Estado:** ✅ Completada  
- Botones de control por línea (`+`, `↓`, `✎`, `×`)
- Menús contextuales y formularios guiados dinámicos
- UX orientada a evitar errores
- `Undo`/`Redo` implementado y funcional
- Arrastrar y soltar seguro (evitando romper jerarquías)

---

### 🟢 FASE 3 — Gestión Global de Variables y Funciones
**Estado:** ✅ Completada  
- Paneles dedicados flotantes y arrastrables
- Sincronización total UI ↔ AST
- Purga inteligente: al eliminar variables/funciones globales, el AST limpia el código huérfano

---

### ⚪ FASE 4 — Transpilación Multilenguaje
**Estado:** ⚪ Pausada estratégicamente  
- Exportador AST (JSON) implementado para leer tokens
*Pendientes:* Crear `Transpilador.js` para leer el JSON y escupir sintaxis Python.

---

### ⚪ FASE 5 — Diagrama de Flujo Sincronizado
**Estado:** ⚪ No iniciada  
- Vista gráfica del AST (Canvas / SVG / Mermaid.js)
- Sincronización en tiempo real con el código

---

### 🟢 FASE 6 — Validación Semántica Avanzada (Adelantada)
**Estado:** ✅ Completada  
- Extracción a módulo `Validador.js` (Poka-yoke)
- Tipos incompatibles bloqueados (Ej: Solo mostrar variables del mismo tipo al asignar)
- Cambio dinámico de inputs (Listas bloqueadas para literales, booleanos usan select, números solo teclado numérico)
- Prevención total de inyecciones de código HTML malicioso (Seguridad Anti-XSS)

---

### 🟢 FASE 7 — Persistencia y Versionado (Adelantada)
**Estado:** ✅ Completada  
- Guardado local automático (`StorageManager`)
- Carga de AST con validación de esquemas (protección contra JSON corruptos)
- Sistema de Backups silentes en caso de falla
- Sincronización automática entre pestañas

---

### 🟡 FASE 8 — UX Final y Pulido (Adelantada)
**Estado:** 🟡 En desarrollo activo ← **ESTADO ACTUAL**
- Selección Múltiple con `Ctrl` implementada
- Atajos de teclado para deshacer (`Ctrl+Z`) y duplicar (`Ctrl+D`)
- Microinteracciones de selección y arrastre
*Pendientes:* Tooltips educativos finales

---

### ⚪ FASE 9 — Release Oficial (v1.0)
**Estado:** ⚪ Pendiente  
Requisitos:
- Motor gráfico de diagrama de flujo
- Transpilación a Python habilitada
- Modo ejercicios guiados habilitado
- Sin bugs críticos

---

## 🧠 Filosofía del Proyecto

> **El usuario aprende lógica, no pelea con la sintaxis.** > **El sistema previene errores en lugar de corregirlos después.**

CodeFlow prioriza **claridad, seguridad y coherencia**, incluso por encima de la flexibilidad total.

---

## 📌 Estado Actual del Proyecto

🟡 **FASES 4 y 5 — Preparación para Transpilación y Diagrama de Flujo** Los cimientos lógicos (AST, Semántica, UI y Persistencia) están completados y blindados. El sistema ahora genera un árbol de tokens perfecto, listo para que se inicie el desarrollo del renderizador visual (Diagrama) o el traductor de texto (Transpilador).

---

## 🚀 Visión a Futuro

- Múltiples lenguajes de salida
- Diagrama de flujo interactivo
- Modo ejercicios guiados
- Uso educativo real en aula

Organizadora del proyecto: Ofelia Gutierrez Giraldi
