# Lab 3 - Library (Books and Authors)

Introduction to Database Systems, Lab 3.

## Team

| Name | ID | Group |
|------|----|-------|
| Kareem Mohamed Said Khalil Ayoub | 2304003 | 2 |
| Abdelrahman Waleed | 2304221 | 2 |

We worked on this lab together as a group of 2. The register, login and to-do pages are from our Lab 2. The books and authors pages are new in this lab.

## Files

- `problem1_DDL.sql` - creates the tables of Part I (COMPANY)
- `problem1_DML.sql` - inserts the data of Part I
- `problem1_Answers.txt` - our answers to Q1.1 to Q1.3
- `problem2_DDL.sql` - creates the `library` database with the `author` and `book` tables. `book.author_id` is a foreign key with ON DELETE CASCADE, so deleting an author also deletes their books.
- `problem2_DML.sql` - inserts 3 authors and 6 books
- `website/` - the website (Lab 2 plus the new pages)

## How to run

1. Install Node.js and MySQL.
2. Clone the repository, then install the packages:
```
git clone <repository link>
cd <repository folder>/website
npm install
```
3. Create the databases. Run these from the main folder (not from `website`), in this order:
```
mysql -u root -p < website/database/schema.sql
mysql -u root -p < problem2_DDL.sql
mysql -u root -p < problem2_DML.sql
```
Part I has its own files. Run `problem1_DDL.sql` and then `problem1_DML.sql` the same way.

4. In the `website` folder, copy `.env.example` to `.env` and write your own values:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=registration
LIB_DB_NAME=library
SESSION_SECRET=any_long_text
PORT=3000
```
5. Start the server from the `website` folder:
```
npm start
```
6. Open http://localhost:3000 in the browser, register, and log in. Use the links at the top of the page: To-Do, Books, Authors.

## What each page does

- F2.1 `/books` shows all the books with their `author_id`. `/authors` shows all the authors.
- F2.2 Add a book (title, price, choose the author) or add an author (name, country). The form is at the top of each page.
- F2.3 Edit: the Edit button opens a form that already has the old values.
- F2.4 Remove a book with the Delete button. It asks "Are you sure?" first.
- F2.5 Remove an author with the Delete button. Their books are deleted too because of ON DELETE CASCADE.

The server checks every form: the fields are required, the text is not longer than the column size in the database, and the price is a number that is 0 or more. If you add a book with an author that does not exist, MySQL gives error 1452 and the page shows a message instead of crashing. All SQL uses `?` so the values are not written inside the query. The books and authors pages need a login.
