USE company;

INSERT INTO department (Dnumber, Dname) VALUES
(1, 'Research'),
(2, 'Administration'),
(3, 'Headquarters');

INSERT INTO employee VALUES
('123456789', 'John', 'Smith', '1990-01-09', 'Alexandria', 'M', 30000.00, 1),
('333445555', 'Franklin', 'Wong', '1985-12-08', 'Cairo', 'M', 40000.00, 1),
('999887777', 'Alicia', 'Zelaya', '1992-07-19', 'Giza', 'F', 25000.00, 2),
('987654321', 'Jennifer', 'Wallace', '1988-06-20', 'Alexandria', 'F', 43000.00, 3);

UPDATE department SET mgr_ssn = '333445555', mgr_start_date = '2020-05-22' WHERE Dnumber = 1;
UPDATE department SET mgr_ssn = '999887777', mgr_start_date = '2021-01-01' WHERE Dnumber = 2;
UPDATE department SET mgr_ssn = '987654321', mgr_start_date = '2019-06-19' WHERE Dnumber = 3;

INSERT INTO project VALUES
(1, 'ProductX', 'Alexandria', 1),
(2, 'ProductY', 'Cairo', 1),
(3, 'Computerization', 'Giza', 2);
