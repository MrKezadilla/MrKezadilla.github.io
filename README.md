# Proyecto-mama-Ofe
Repositorio oficial para la creación el desarrollo del programa capaz de transpilar pseudocodigo a python/otros lenguajes

# 🧠 CodeFlow — Editor Educativo de Pseudocódigo

CodeFlow es un **editor visual educativo** diseñado para enseñar lógica de programación de forma **segura, guiada y estructurada**, evitando errores comunes del principiante mediante un sistema basado en **AST (Árbol de Sintaxis Abstracta)** y transpilación automática a Python.

El usuario **no escribe código libremente**: construye programas mediante **bloques lógicos validados**, lo que garantiza coherencia, tipado correcto y una experiencia pedagógica sólida.

---

## 🎯 Objetivo del Proyecto

- Enseñar **pensamiento algorítmico**, no sintaxis
- Reducir errores por diseño (UX segura)
- Representar programas como un **modelo lógico real**
- Permitir múltiples vistas del mismo programa:
  - Pseudocódigo
  - Código Python
  - Diagrama de flujo (futuro)

---

## ⚙️ Funcionalidades Principales (Esperadas)

### 🧩 Editor de Pseudocódigo
- Inserción de instrucciones mediante botón `+`
- Menús contextuales por categoría
- Indentación automática
- Bloques estructurados (`Si`, `Mientras`, `Para`, `Función`)
- Líneas placeholder para guiar al usuario
- Eliminación segura de nodos

### 📦 Gestión de Variables
- Declaración explícita
- Tipos inmutables (`number`, `string`)
- Inicialización automática segura
- Uso exclusivo mediante selección (no texto libre)
- Registro centralizado de variables

### 🧠 Funciones
- Definición de funciones con parámetros
- Bloques con scope propio
- Separación entre definición y uso
- Registro central de funciones

### 🔀 Control de Flujo
- Condicionales (`Si`)
- Bucles (`Mientras`)
- Bucles `Para`:
  - Por rango
  - Iterativos (planeado)

### ⌨️ Entrada / Salida
- `Leer` (input)
- `Mostrar`:
  - Texto
  - Variables
  - Texto + variables combinadas (planeado)

### 🔄 Transpilación
- Conversión del AST a Python
- Código legible y seguro
- Inicialización correcta de variables
- Bloques correctamente indentados

### 🧱 Arquitectura Interna
- AST como única fuente de verdad
- UI como proyección del modelo
- Separación clara:
  - Modelo
  - Vista
  - Lógica
  - Transpilador

---

## 🗺️ Fases del Desarrollo del Proyecto

### 🟢 FASE 0 — Definición del Lenguaje
**Estado:** ✅ Completada  
- Palabras clave
- Tipos de datos
- Reglas del pseudocódigo
- Semántica básica

---

### 🟢 FASE 1 — Modelo Lógico (AST)
**Estado:** ✅ Completada  
- AST jerárquico
- Nodos tipados
- Relación padre–hijo
- Inserción y borrado controlado

---

### 🟡 FASE 2 — Editor Visual Seguro
**Estado:** 🟡 En desarrollo activo ← **ESTADO ACTUAL**
- Botón `+` por línea
- Menús contextuales
- Formularios guiados
- Bloques visuales
- UX orientada a evitar errores

Pendientes:
- Redo
- Pulido del flujo `Mostrar`
- Refinamiento de interacción

---

### 🟡 FASE 3 — Gestión Global de Variables y Funciones
**Estado:** 🟡 Parcial  
- Registro central implementado
- UI dedicada en planeación
- Sin edición directa en pseudocódigo

Pendientes:
- Paneles dedicados
- Sincronización total UI ↔ AST

---

### 🔵 FASE 4 — Transpilación Multilenguaje
**Estado:** 🔵 Parcial  
- Python implementado
- Arquitectura preparada para expansión

Pendientes:
- `Mostrar` con interpolación (`f-strings`)
- Soporte futuro para otros lenguajes

---

### ⚪ FASE 5 — Diagrama de Flujo Sincronizado
**Estado:** ⚪ No iniciada  
- Vista gráfica del AST
- Sin edición directa
- Sincronización en tiempo real

---

### ⚪ FASE 6 — Validación Semántica Avanzada
**Estado:** ⚪ No iniciada  
- Errores de scope
- Tipos incompatibles
- Uso indebido de variables
- Validaciones educativas

---

### ⚪ FASE 7 — Persistencia y Versionado
**Estado:** ⚪ No iniciada  
- Guardar proyectos
- Cargar AST
- Exportar / importar

---

### ⚪ FASE 8 — UX Final y Pulido
**Estado:** ⚪ No iniciada  
- Tooltips
- Atajos
- Microinteracciones
- Mensajes educativos

---

### ⚪ FASE 9 — Release Oficial (v1.0)
**Estado:** ⚪ Pendiente  
Requisitos:
- AST estable
- Editor seguro
- Transpilación correcta
- UX coherente
- Sin bugs críticos

---

## 🧠 Filosofía del Proyecto

> **El usuario aprende lógica, no pelea con la sintaxis.**  
> **El sistema previene errores en lugar de corregirlos después.**

CodeFlow prioriza **claridad, seguridad y coherencia**, incluso por encima de la flexibilidad total.

---

## 📌 Estado Actual del Proyecto

🟡 **FASE 2 — Editor Visual Seguro**  
El proyecto se encuentra en una etapa funcional, con arquitectura sólida y enfoque claro, avanzando hacia refinamiento y expansión controlada.

---

## 🚀 Visión a Futuro

- Múltiples lenguajes de salida
- Diagrama de flujo interactivo
- Modo ejercicios guiados
- Uso educativo real en aula

texto de ejemplo
---

**CodeFlow no es un editor de código.  
Es un constructor de pensamiento lógico.**

Organizadora del proyecto : Ofelia Gutierrez Giraldi
