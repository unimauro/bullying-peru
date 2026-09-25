#!/usr/bin/env python3
"""
Control de divulgación estadística para el desglose por tipo (colegio-año).

Regla (revisión seguridad/ética 25-09-2026, docs/reviews/2026-09-25-seguridad.md §1):
  1. `sexual` y `personal_ie` con valor 1–4 se publican como SENTINEL (-1 = "<5").
  2. Supresión complementaria: los tipos forman particiones del total del año
     (física + psicológica + sexual = total; entre_escolares + personal_ie = total),
     así que una celda suprimida se recupera por resta si sus compañeras se publican.
     Por eso, si CUALQUIER miembro de una partición queda suprimido en un año, se
     suprime la partición completa ese año (incluidos los ceros: 0 + 0 + "<5" con
     total 2 también revela la celda). El total del año se conserva.
  3. Nivel Inicial: no se publica ningún desglose (> 0 -> SENTINEL).
  4. Jerarquía: una institución (varios servicios) publica una celda solo si
     ninguno de sus servicios la tiene suprimida; si no, inst − Σ servicios
     publicados recuperaría la celda del servicio. Se pasa como `mascara`.
  5. No se publica un acumulado 2013–2026 por tipo calculado desde el dato crudo:
     acumulado − celdas publicadas recupera las suprimidas. El front debe sumar
     solo las celdas publicadas.

Los valores -1 los interpreta el front (app.js: SUP/SUPN) como "<5".
"""

K = 5
SENTINEL = -1
SENSIBLES = ("sexual", "personal_ie")
PARTICIONES = (
    ("fisica", "psicologica", "sexual"),
    ("entre_escolares", "personal_ie"),
)


def es_inicial(nivel):
    return str(nivel or "").startswith("Inicial")


def suprimir_tipos(tipos, nivel=None, mascara=None):
    """Devuelve una copia de `tipos` (dict tipo -> [int por año]) con las celdas
    suprimidas puestas a SENTINEL. `mascara` es un conjunto de (tipo, i) que deben
    suprimirse además (p. ej. celdas suprimidas en los servicios de una institución)."""
    out = {k: list(v) for k, v in tipos.items()}
    n = max((len(v) for v in out.values()), default=0)
    inicial = es_inicial(nivel)
    for k, v in out.items():
        for i, x in enumerate(v):
            if x > 0 and (inicial or (k in SENSIBLES and x < K)):
                v[i] = SENTINEL
    for k, i in (mascara or ()):
        if k in out and i < len(out[k]):
            out[k][i] = SENTINEL
    # complementaria: partición completa suprimida si algún miembro lo está
    for particion in PARTICIONES:
        miembros = [k for k in particion if k in out]
        for i in range(n):
            if any(out[k][i] == SENTINEL for k in miembros):
                for k in miembros:
                    out[k][i] = SENTINEL
    return out


def mascara_de(tipos_list):
    """Conjunto de (tipo, i) suprimidos en cualquiera de los dicts dados."""
    m = set()
    for tp in tipos_list:
        for k, v in tp.items():
            for i, x in enumerate(v):
                if x == SENTINEL:
                    m.add((k, i))
    return m


def verificar(tipos, y=None):
    """Lista de problemas: partición parcialmente suprimida (recuperable por resta)."""
    problemas = []
    n = max((len(v) for v in tipos.values()), default=0)
    for particion in PARTICIONES:
        miembros = [k for k in particion if k in tipos]
        for i in range(n):
            sup = [k for k in miembros if tipos[k][i] == SENTINEL]
            if sup and len(sup) != len(miembros):
                problemas.append((i, particion, sup))
    return problemas
