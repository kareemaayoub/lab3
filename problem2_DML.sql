USE library;

INSERT INTO author (name, country) VALUES
('Jane Austen', 'England'),
('Naguib Mahfouz', 'Egypt'),
('Haruki Murakami', 'Japan');

INSERT INTO book (title, price, author_id) VALUES
('Emma', 12.50, 1),
('Persuasion', 9.99, 1),
('Pride and Prejudice', 11.00, 1),
('Palace Walk', 15.00, 2),
('Midaq Alley', 8.75, 2),
('Kafka on the Shore', 14.20, 3);
