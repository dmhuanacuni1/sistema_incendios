-- =============================================================================
-- DATOS INICIALES DE PRUEBA (SEEDS)
-- Sistema de Gestión de Incendios Forestales
-- =============================================================================

-- 1. Roles
INSERT INTO roles (nombre_rol, descripcion) VALUES
('ADMINISTRADOR', 'Control total del sistema, gestión de estaciones, recursos y reportes'),
('OPERADOR', 'Operador de central, recepción de avisos y gestión de incidentes'),
('BOMBERO', 'Personal operativo en campo y jefes de cuadrilla'),
('CIUDADANO', 'Usuario público que reporta avisos de incendios y recibe alertas')
ON CONFLICT (nombre_rol) DO NOTHING;

-- 2. Personas
INSERT INTO personas (nombres, apellidos, telefono, correo, direccion, tipo_persona) VALUES
('Carlos', 'Mendoza Arce', '77123456', 'admin@example.com', 'Av. Las Palmas #123, Central', 'ADMINISTRADOR'),
('Lucía', 'Fernández Ramos', '77234567', 'operador1@example.com', 'Calle Murillo #450, Zona Norte', 'OPERADOR'),
('Jorge', 'Salazar Gutiérrez', '77345678', 'jorge@example.com', 'Av. 6 de Agosto #789, Miraflores', 'BOMBERO'),
('Mario', 'Vargas Peñaranda', '77456789', 'mario@example.com', 'Calle Sucre #234, San Pedro', 'BOMBERO'),
('Ana', 'Roca Beltrán', '77567890', 'ana@example.com', 'Av. Ballivián #567, Calacoto', 'CIUDADANO');

-- 3. Usuarios
-- Hashes reales con werkzeug scrypt. Cuentas de prueba: admin/admin123, operador1/operador123, bombero_jorge y bombero_mario/bombero123, ciudadano_ana/ciudadano123
INSERT INTO usuarios (id_persona, id_rol, nombre_usuario, hash_contrasena, estado) VALUES
(1, 1, 'admin', 'scrypt:32768:8:1$ZOmyWe0dohIP91vb$c9e327ebe7c3127d21b4cad46aa41921dba77444296adce99fe2fe378b2847dae635d7bb1171ccc912de74bf9d328d29c143cdc65681d1ce7543cbd50f495a9a', 'ACTIVO'),
(2, 2, 'operador1', 'scrypt:32768:8:1$4XN7GH2rwiTRolEe$f5d4f89cfaa23514d5794c5e56adc9aab7e5d1602e37fd8b592278be755295a873984d9b3ad78a64683d4c6a7f16d1f73689c141972b2ef27d63acea7327ee49', 'ACTIVO'),
(3, 3, 'bombero_jorge', 'scrypt:32768:8:1$zZKDk0yzVJWcChdX$087ed82f99d12a89bfc0e91a0151e4efb613bcb10fff135d2e02c77f6007c5be0c25506b5121a59f76737bae84ca009612f39cc0b59467631998a974a6c7a0d5', 'ACTIVO'),
(4, 3, 'bombero_mario', 'scrypt:32768:8:1$7F7gy14BWvBtIZ7K$c035df866308200d387acce830ed4ca80444379d800e634f685b13f704b63a565722189a72b178a597a79241f8d311e26071a090f907a8cacad5d8ad11c23674', 'ACTIVO'),
(5, 4, 'ciudadano_ana', 'scrypt:32768:8:1$K62gs0o4kbkkZCT2$ed0725b19e08a6241f3221da5790da8bb1e81fe09eb1993d0a31d58077700af4fddad12e3deec89f533b280c74b0d765e40d649ec6ea385aa4ce628bfafb7385', 'ACTIVO')
ON CONFLICT (nombre_usuario) DO NOTHING;

-- 4. Zonas de Riesgo
INSERT INTO zonas_riesgo (nombre, ubicacion, nivel_riesgo, descripcion, id_administrador) VALUES
('Parque Nacional Tunari - Sector A', 'Coord: -17.3125, -66.1842', 'ALTO', 'Zona de bosque de pinos y eucaliptos con alta pendiente', 1),
('Cordillera Oriental - Valle Alto', 'Coord: -17.5241, -65.9812', 'MEDIO', 'Pajonales y matorrales secos', 1),
('Reserva Forestal Serranía', 'Coord: -17.2054, -66.3011', 'EXTREMO', 'Pastizales densos cercanos a comunidades', 1);

-- 5. Estaciones
INSERT INTO estaciones (nombre, direccion, telefono, id_administrador) VALUES
('Estación Central de Bomberos #1', 'Av. Circunvalación esq. Av. América', '4421111', 1),
('Sub-estación Valle Norte #2', 'Carretera al Norte Km 8', '4432222', 1);

-- 6. Unidades (Vehículos)
INSERT INTO unidades (codigo, tipo, capacidad, estado, motivo_estado, id_estacion, id_administrador) VALUES
('B-101', 'Autobomba Pesada', '4000 Litros de agua', 'DISPONIBLE', 'Operativa con mantenimiento al día', 1, 1),
('C-201', 'Cisterna de Apoyo', '10000 Litros de agua', 'DISPONIBLE', 'Lista para abastecimiento', 1, 1),
('R-301', 'Vehículo Rápido 4x4', '4 rescatistas + 500L', 'DISPONIBLE', 'En patrullaje preventivo', 2, 1)
ON CONFLICT (codigo) DO NOTHING;

-- 7. Recursos (NUEVA ENTIDAD RECURSO)
-- Tipos: 'equipo', 'herramienta', 'insumo'
INSERT INTO recursos (nombre, tipo_recurso, cantidad, estado, motivo_estado, id_estacion, id_administrador) VALUES
('Mochila Aspersora 20L', 'equipo', 25, 'DISPONIBLE', 'Cargadas y revisadas', 1, 1),
('Matafuegos / Batefuegos Forestal', 'herramienta', 40, 'DISPONIBLE', 'Herramientas manuales afiladas', 1, 1),
('Motosierra Stihl MS 381', 'equipo', 6, 'DISPONIBLE', 'Con cadena de repuesto y aceite', 1, 1),
('Retardante Químico de Fuego (Bidón 20L)', 'insumo', 50, 'DISPONIBLE', 'En almacén seco', 1, 1),
('Rastrillo McLeod', 'herramienta', 30, 'DISPONIBLE', 'Excelente estado para líneas de defensa', 2, 1),
('Pulaski (Hacha-Azadón)', 'herramienta', 20, 'DISPONIBLE', 'Inspeccionadas', 2, 1),
('Botiquín de Trauma Forestal', 'insumo', 15, 'DISPONIBLE', 'Completos con vendas y apósitos de quemaduras', 1, 1);

-- 8. Brigadas
INSERT INTO brigadas (nombre, estado, motivo_estado, id_estacion) VALUES
('Brigada Puma - Cuadrilla Forestal 1', 'ACTIVA', 'Personal completo y preparado', 1),
('Brigada Cóndor - Ataque Rápido', 'ACTIVA', 'Guardia diurna', 2);

-- 9. Miembros de Brigada
INSERT INTO brigada_miembros (id_brigada, id_persona, rol_en_brigada, estado) VALUES
(1, 3, 'JEFE_CUADRILLA', 'ACTIVO'),
(1, 4, 'BOMBERO', 'ACTIVO')
ON CONFLICT (id_brigada, id_persona) DO NOTHING;

-- 10. Tipos de Alerta
INSERT INTO tipos_alerta (nombre, plantilla_mensaje) VALUES
('ALERTA ROJA - EVACUACIÓN', 'URGENTE: Incendio descontrolado avanzando hacia {zona}. Evacúe inmediatamente hacia {refugio}.'),
('ALERTA AMARILLA - PREVENCIÓN', 'PRECAUCIÓN: Foco de calor detectado en {zona}. Evite realizar chaqueos o encender fogatas.'),
('ALERTA VERDE - CONTROLADO', 'AVISO: El incendio en {zona} ha sido contenido y liquidado por las cuadrillas de bomberos.')
ON CONFLICT (nombre) DO NOTHING;

-- 11. Avisos de Incendio
INSERT INTO avisos_incendio (id_ciudadano, ubicacion, descripcion, nivel_urgencia, estado_aviso) VALUES
(5, 'Cerro San Pedro, cara este', 'Humo blanco y luego negro saliendo de los matorrales', 'ALTO', 'VERIFICADO');

-- 12. Incidentes
INSERT INTO incidentes (id_aviso, id_operador, id_zona, ubicacion, gravedad, estado) VALUES
(1, 2, 1, 'Sector Tunari Km 5', 'ALTA', 'ACTIVO');

-- 13. Asignación de Brigada a Incidente
INSERT INTO incidente_brigadas (id_incidente, id_brigada, estado_asignacion) VALUES
(1, 1, 'EN_SITIO');
