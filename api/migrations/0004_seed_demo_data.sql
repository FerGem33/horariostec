-- Migration: Seed sample/demo data for HorariosTec
PRAGMA foreign_keys = ON;

-- 1. Insert Active Academic Term
INSERT INTO terms (code, name, is_active) VALUES
  ('2026-2', 'Agosto - Diciembre 2026', 1)
ON CONFLICT(code) DO UPDATE SET is_active = 1;

-- 2. Insert Teachers
INSERT INTO teachers (id, normalized_name, display_name) VALUES
  (1, 'martinez lopez carlos', 'Ing. Carlos Martínez López'),
  (2, 'hernandez garcia ana maria', 'Dra. Ana María Hernández García'),
  (3, 'rodriguez trevino jose luis', 'M.C. José Luis Rodríguez Treviño'),
  (4, 'gonzalez davila maria elena', 'Ing. María Elena González Dávila'),
  (5, 'garza sanchez roberto', 'Dr. Roberto Garza Sánchez'),
  (6, 'torres vazquez sofia', 'M.I. Sofía Torres Vázquez'),
  (7, 'castillo morales fernando', 'Ing. Fernando Castillo Morales'),
  (8, 'ramirez ortiz patricia', 'Dra. Patricia Ramírez Ortiz')
ON CONFLICT(normalized_name) DO UPDATE SET display_name = excluded.display_name;

-- 3. Insert Subjects for Careers
-- Sistemas (career_id = 1)
INSERT INTO subjects (id, career_id, semester, code, name, credits) VALUES
  (1, 1, 1, 'INC-1001', 'Fundamentos de Programación', 5),
  (2, 1, 2, 'INC-1002', 'Programación Orientada a Objetos', 5),
  (3, 1, 3, 'INC-1003', 'Estructura de Datos', 5),
  (4, 1, 4, 'INC-1004', 'Taller de Bases de Datos', 4),
  (5, 1, 5, 'INC-1005', 'Fundamentos de Telecomunicaciones', 4),
  (6, 1, 6, 'INC-1006', 'Sistemas Operativos', 4),
  (7, 1, 7, 'INC-1007', 'Ingeniería de Software', 5),
  (8, 1, 8, 'INC-1008', 'Inteligencia Artificial', 5),

-- Mecatrónica (career_id = 2)
  (9, 2, 1, 'MT-1001', 'Cálculo Diferencial', 5),
  (10, 2, 2, 'MT-1002', 'Álgebra Lineal', 5),
  (11, 2, 3, 'MT-1003', 'Electrónica Analógica', 5),
  (12, 2, 4, 'MT-1004', 'Microcontroladores', 5),
  (13, 2, 5, 'MT-1005', 'Robótica Industrial', 5),

-- Mecánica (career_id = 3)
  (14, 3, 1, 'MC-1001', 'Mecánica de Materiales', 5),
  (15, 3, 2, 'MC-1002', 'Termodinámica', 5),
  (16, 3, 3, 'MC-1003', 'Diseño de Elementos de Máquinas', 5),

-- Industrial (career_id = 4)
  (17, 4, 1, 'IND-1001', 'Introducción a la Ingeniería Industrial', 4),
  (18, 4, 2, 'IND-1002', 'Estadística Inferencial', 5),
  (19, 4, 3, 'IND-1003', 'Logística y Cadenas de Suministro', 5),

-- Eléctrica (career_id = 5)
  (20, 5, 1, 'ELE-1001', 'Circuitos Eléctricos I', 5),
  (21, 5, 2, 'ELE-1002', 'Sistemas de Potencia', 5),

-- Electrónica (career_id = 6)
  (22, 6, 1, 'ET-1001', 'Diseño Digital', 5),
  (23, 6, 2, 'ET-1002', 'Procesamiento Digital de Señales', 5),

-- Gestión Empresarial (career_id = 7)
  (24, 7, 1, 'IGE-1001', 'Fundamentos de Gestión Empresarial', 4),
  (25, 7, 2, 'IGE-1002', 'Mercadotecnia', 5),

-- Materiales (career_id = 8)
  (26, 8, 1, 'MAT-1001', 'Química de Materiales', 5),
  (27, 8, 2, 'MAT-1002', 'Caracterización de Materiales', 5)
ON CONFLICT(career_id, semester, code, name) DO NOTHING;

-- 4. Insert Sections
INSERT INTO sections (id, term_id, career_id, subject_id, teacher_id, group_name, source_key) VALUES
  (1, 1, 1, 1, 1, '1A', '2026-2:sistemas:INC-1001:1A'),
  (2, 1, 1, 1, 2, '1B', '2026-2:sistemas:INC-1001:1B'),
  (3, 1, 1, 2, 1, '2A', '2026-2:sistemas:INC-1002:2A'),
  (4, 1, 1, 3, 3, '3A', '2026-2:sistemas:INC-1003:3A'),
  (5, 1, 1, 4, 4, '4A', '2026-2:sistemas:INC-1004:4A'),
  (6, 1, 1, 7, 5, '7A', '2026-2:sistemas:INC-1007:7A'),
  (7, 1, 2, 9, 6, '1A', '2026-2:mecatronica:MT-1001:1A'),
  (8, 1, 2, 12, 5, '4A', '2026-2:mecatronica:MT-1004:4A'),
  (9, 1, 3, 14, 7, '1A', '2026-2:mecanica:MC-1001:1A'),
  (10, 1, 4, 17, 8, '1A', '2026-2:industrial:IND-1001:1A'),
  (11, 1, 5, 20, 3, '1A', '2026-2:electrica:ELE-1001:1A'),
  (12, 1, 6, 22, 6, '1A', '2026-2:electronica:ET-1001:1A'),
  (13, 1, 7, 24, 4, '1A', '2026-2:gestion:IGE-1001:1A'),
  (14, 1, 8, 26, 2, '1A', '2026-2:materiales:MAT-1001:1A')
ON CONFLICT(source_key) DO NOTHING;

-- 5. Insert Class Meetings
INSERT INTO class_meetings (section_id, day_of_week, start_time, end_time, room) VALUES
  -- Sec 1 (Sistemas INC-1001 1A)
  (1, 0, '07:00', '09:00', 'Edificio H - Lab 2'),
  (1, 2, '07:00', '09:00', 'Edificio H - Lab 2'),
  (1, 4, '07:00', '08:00', 'Aula H1'),
  -- Sec 2 (Sistemas INC-1001 1B)
  (2, 1, '09:00', '11:00', 'Edificio H - Lab 1'),
  (2, 3, '09:00', '11:00', 'Edificio H - Lab 1'),
  -- Sec 3 (Sistemas INC-1002 2A)
  (3, 0, '09:00', '11:00', 'Edificio H - Lab 3'),
  (3, 2, '09:00', '11:00', 'Edificio H - Lab 3'),
  -- Sec 4 (Sistemas INC-1003 3A)
  (4, 1, '11:00', '13:00', 'Aula H4'),
  (4, 3, '11:00', '13:00', 'Aula H4'),
  -- Sec 5 (Sistemas INC-1004 4A)
  (5, 0, '11:00', '13:00', 'Edificio H - Lab BD'),
  (5, 2, '11:00', '13:00', 'Edificio H - Lab BD'),
  -- Sec 6 (Sistemas INC-1007 7A)
  (6, 1, '13:00', '15:00', 'Aula H6'),
  (6, 3, '13:00', '15:00', 'Aula H6'),
  -- Sec 7 (Mecatrónica MT-1001 1A)
  (7, 0, '08:00', '10:00', 'Aula M1'),
  (7, 2, '08:00', '10:00', 'Aula M1'),
  -- Sec 8 (Mecatrónica MT-1004 4A)
  (8, 1, '10:00', '12:00', 'Lab Micro'),
  (8, 3, '10:00', '12:00', 'Lab Micro'),
  -- Sec 9 (Mecánica MC-1001 1A)
  (9, 0, '07:00', '09:00', 'Taller Mecánica'),
  (9, 2, '07:00', '09:00', 'Taller Mecánica'),
  -- Sec 10 (Industrial IND-1001 1A)
  (10, 1, '08:00', '10:00', 'Aula I2'),
  (10, 3, '08:00', '10:00', 'Aula I2'),
  -- Sec 11 (Eléctrica ELE-1001 1A)
  (11, 0, '10:00', '12:00', 'Lab Electricidad'),
  (11, 2, '10:00', '12:00', 'Lab Electricidad'),
  -- Sec 12 (Electrónica ET-1001 1A)
  (12, 1, '11:00', '13:00', 'Lab Electrónica'),
  (12, 3, '11:00', '13:00', 'Lab Electrónica'),
  -- Sec 13 (Gestión IGE-1001 1A)
  (13, 0, '09:00', '11:00', 'Aula G3'),
  (13, 2, '09:00', '11:00', 'Aula G3'),
  -- Sec 14 (Materiales MAT-1001 1A)
  (14, 1, '12:00', '14:00', 'Lab Química'),
  (14, 3, '12:00', '14:00', 'Lab Química');

-- 6. Insert Legacy Teacher Summaries
INSERT INTO legacy_teacher_summaries (teacher_id, review_count, fair_percent, explains_well_percent, hard_percent, homework_percent, attendance_percent, general_score, source_label, source_url) VALUES
  (1, 24, 90.0, 95.0, 40.0, 70.0, 95.0, 92.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/1'),
  (2, 31, 95.0, 98.0, 35.0, 80.0, 100.0, 96.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/2'),
  (3, 18, 80.0, 85.0, 60.0, 75.0, 90.0, 84.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/3'),
  (4, 28, 88.0, 90.0, 50.0, 65.0, 92.0, 89.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/4'),
  (5, 15, 75.0, 80.0, 70.0, 85.0, 85.0, 78.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/5'),
  (6, 22, 92.0, 94.0, 45.0, 70.0, 98.0, 93.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/6'),
  (7, 12, 70.0, 75.0, 65.0, 60.0, 80.0, 72.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/7'),
  (8, 20, 85.0, 88.0, 55.0, 75.0, 90.0, 86.0, 'HazTuHorario', 'https://haztuhorario.com/docentes/8')
ON CONFLICT(teacher_id) DO UPDATE SET review_count = excluded.review_count, general_score = excluded.general_score;

-- 7. Insert Teacher Evaluations & Comments
INSERT INTO teacher_evaluations (id, teacher_id, subject_id, term_id, global_rating, comment, status) VALUES
  (1, 1, 1, 1, 95, 'Excelente profesor, domina completamente los temas de programación y siempre ayuda a resolver dudas.', 'visible'),
  (2, 1, 2, 1, 90, 'Muy organizado con sus clases y tareas. Los exámenes son justos.', 'visible'),
  (3, 2, 1, 1, 98, 'La mejor docente del área. Explica con ejemplos prácticos y la clase es muy amena.', 'visible'),
  (4, 3, 3, 1, 85, 'Buen profesor pero exige mucho en los proyectos finales. Recomendado si quieres aprender.', 'visible'),
  (5, 5, 7, 1, 80, 'Sus materias son retadoras pero se aprende bastante sobre arquitectura e ingeniería de software.', 'visible')
ON CONFLICT(id) DO NOTHING;

INSERT INTO evaluation_answers (evaluation_id, question_key, numeric_value) VALUES
  (1, 'fairness', 5), (1, 'explains', 5), (1, 'attitude', 5), (1, 'accessibility', 5), (1, 'difficulty', 3),
  (2, 'fairness', 4), (2, 'explains', 4), (2, 'attitude', 5), (2, 'accessibility', 4), (2, 'difficulty', 3),
  (3, 'fairness', 5), (3, 'explains', 5), (3, 'attitude', 5), (3, 'accessibility', 5), (3, 'difficulty', 2),
  (4, 'fairness', 4), (4, 'explains', 4), (4, 'attitude', 4), (4, 'accessibility', 4), (4, 'difficulty', 4),
  (5, 'fairness', 4), (5, 'explains', 4), (5, 'attitude', 4), (5, 'accessibility', 3), (5, 'difficulty', 4)
ON CONFLICT(evaluation_id, question_key) DO NOTHING;
