DROP DATABASE IF EXISTS library;
CREATE DATABASE library;
USE library;

CREATE TABLE author (
    author_id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    photo VARCHAR(255),
    PRIMARY KEY (author_id)
);

CREATE TABLE book (
    book_id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    author_id INT NOT NULL,
    cover VARCHAR(255),
    PRIMARY KEY (book_id),
    FOREIGN KEY (author_id) REFERENCES author(author_id) ON DELETE CASCADE
);
