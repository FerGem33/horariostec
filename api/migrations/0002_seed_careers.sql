INSERT INTO careers (slug, name) VALUES
  ('sistemas', 'Sistemas'),
  ('mecatronica', 'Mecatrónica'),
  ('mecanica', 'Mecánica'),
  ('industrial', 'Industrial'),
  ('electrica', 'Eléctrica'),
  ('electronica', 'Electrónica'),
  ('gestion', 'Gestión Empresarial'),
  ('materiales', 'Materiales')
ON CONFLICT(slug) DO UPDATE SET name = excluded.name;
