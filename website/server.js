const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey',
  resave: false,
  saveUninitialized: false
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

const handle = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function checkTitle(raw) {
  const title = (raw || '').trim();
  if (title === '') return { title, error: 'Title is required' };
  if (title.length > 200) return { title, error: 'Title is too long (200 characters at most)' };
  return { title, error: null };
}

async function showTodos(req, res, opts = {}) {
  const [todos] = await db.execute(
    'SELECT todo_id, title, is_done, created_at FROM todos WHERE user_id = ? ORDER BY todo_id DESC',
    [req.session.userId]
  );
  res.status(opts.status || 200).render('todo', {
    name: req.session.userName,
    todos,
    errors: opts.errors || {},
    old: opts.old || {},
    editId: opts.editId || null
  });
}

app.get('/', (req, res) => {
  res.redirect(req.session.userId ? '/todo' : '/login');
});

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/todo');
  res.render('register', { errors: {}, old: {} });
});

app.post('/register', handle(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const confirm = req.body.confirm_password || '';

  const errors = {};
  if (name === '') errors.name = 'Name is required';
  if (email === '') errors.email = 'Email is required';
  if (password === '') errors.password = 'Password is required';
  if (confirm === '') errors.confirm = 'Confirm password is required';
  else if (password !== '' && password !== confirm) errors.confirm = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('register', { errors, old: { name, email } });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email, name, hash]
    );
    req.session.userId = result.insertId;
    req.session.userName = name;
    res.redirect('/todo');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).render('register', {
        errors: { email: 'Email Already Exists' },
        old: { name, email }
      });
    }
    throw err;
  }
}));

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/todo');
  res.render('login', { errors: {}, old: {} });
});

app.post('/login', handle(async (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';

  const errors = {};
  if (email === '') errors.email = 'Email is required';
  if (password === '') errors.password = 'Password is required';
  if (Object.keys(errors).length > 0) {
    return res.status(400).render('login', { errors, old: { email } });
  }

  const [rows] = await db.execute(
    'SELECT user_id, name, password_hash FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!ok) {
    return res.status(401).render('login', {
      errors: { general: 'Invalid email or password' },
      old: { email }
    });
  }

  req.session.userId = user.user_id;
  req.session.userName = user.name;
  res.redirect('/todo');
}));

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/todo', requireLogin, handle(async (req, res) => {
  await showTodos(req, res);
}));

app.post('/todo', requireLogin, handle(async (req, res) => {
  const { title, error } = checkTitle(req.body.title);
  if (error) {
    return showTodos(req, res, { status: 400, errors: { add: error }, old: { title: req.body.title || '' } });
  }
  await db.execute(
    'INSERT INTO todos (user_id, title) VALUES (?, ?)',
    [req.session.userId, title]
  );
  res.redirect('/todo');
}));

app.post('/todo/edit/:id', requireLogin, handle(async (req, res) => {
  const { title, error } = checkTitle(req.body.title);
  if (error) {
    return showTodos(req, res, {
      status: 400,
      errors: { edit: error },
      old: { title: req.body.title || '' },
      editId: req.params.id
    });
  }
  await db.execute(
    'UPDATE todos SET title = ? WHERE todo_id = ? AND user_id = ?',
    [title, req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

app.post('/todo/done/:id', requireLogin, handle(async (req, res) => {
  const isDone = req.body.is_done === '1' ? 1 : 0;
  await db.execute(
    'UPDATE todos SET is_done = ? WHERE todo_id = ? AND user_id = ?',
    [isDone, req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

app.post('/todo/delete/:id', requireLogin, handle(async (req, res) => {
  await db.execute(
    'DELETE FROM todos WHERE todo_id = ? AND user_id = ?',
    [req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

// library database connection
const libDb = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.LIB_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

// SQL for each page (? is where a value goes)
const SQL = {
  allAuthors: 'SELECT author_id, name, country FROM author ORDER BY author_id',
  oneAuthor: 'SELECT author_id, name, country FROM author WHERE author_id = ?',
  addAuthor: 'INSERT INTO author (name, country) VALUES (?, ?)',
  editAuthor: 'UPDATE author SET name = ?, country = ? WHERE author_id = ?',
  deleteAuthor: 'DELETE FROM author WHERE author_id = ?',
  allBooks: 'SELECT book_id, title, price, author_id FROM book ORDER BY book_id',
  oneBook: 'SELECT book_id, title, price, author_id FROM book WHERE book_id = ?',
  addBook: 'INSERT INTO book (title, price, author_id) VALUES (?, ?, ?)',
  editBook: 'UPDATE book SET title = ?, price = ?, author_id = ? WHERE book_id = ?',
  deleteBook: 'DELETE FROM book WHERE book_id = ?'
};

// same sizes as the VARCHARs in the DDL
const MAX = { name: 100, country: 50, title: 200 };

function checkText(raw, label, max) {
  const value = (raw || '').trim();
  if (value === '') return { value, error: label + ' is required' };
  if (value.length > max) return { value, error: label + ' is too long (' + max + ' characters at most)' };
  return { value, error: null };
}

function checkPrice(raw) {
  const text = (raw || '').trim();
  if (text === '') return { value: null, error: 'Price is required' };
  const n = Number(text);
  if (isNaN(n) || n < 0) return { value: null, error: 'Price must be a number of 0 or more' };
  if (n > 99999999) return { value: null, error: 'Price is too large' };
  return { value: n.toFixed(2), error: null };
}

function checkAuthorId(raw) {
  if (!raw || isNaN(raw)) return { value: null, error: 'Please choose an author' };
  return { value: Number(raw), error: null };
}

// authors
async function showAuthors(req, res, opts = {}) {
  const [authors] = await libDb.execute(SQL.allAuthors);
  res.status(opts.status || 200).render('authors', {
    userName: req.session.userName,
    authors,
    errors: opts.errors || {},
    old: opts.old || {}
  });
}

app.get('/authors', requireLogin, handle(async (req, res) => {
  await showAuthors(req, res);
}));

app.post('/authors', requireLogin, handle(async (req, res) => {
  const name = checkText(req.body.name, 'Name', MAX.name);
  const country = checkText(req.body.country, 'Country', MAX.country);
  const error = name.error || country.error;
  if (error) {
    return showAuthors(req, res, { status: 400, errors: { add: error }, old: req.body });
  }
  await libDb.execute(SQL.addAuthor, [name.value, country.value]);
  res.redirect('/authors');
}));

app.get('/authors/:id/edit', requireLogin, handle(async (req, res) => {
  const [rows] = await libDb.execute(SQL.oneAuthor, [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
  }
  res.render('author-edit', { userName: req.session.userName, author: rows[0], error: '' });
}));

app.post('/authors/:id/edit', requireLogin, handle(async (req, res) => {
  const name = checkText(req.body.name, 'Name', MAX.name);
  const country = checkText(req.body.country, 'Country', MAX.country);
  const error = name.error || country.error;
  if (error) {
    const typed = { author_id: req.params.id, name: req.body.name || '', country: req.body.country || '' };
    return res.status(400).render('author-edit', { userName: req.session.userName, author: typed, error });
  }
  await libDb.execute(SQL.editAuthor, [name.value, country.value, req.params.id]);
  res.redirect('/authors');
}));

app.post('/authors/:id/delete', requireLogin, handle(async (req, res) => {
  await libDb.execute(SQL.deleteAuthor, [req.params.id]);
  res.redirect('/authors');
}));

// books
async function showBooks(req, res, opts = {}) {
  const [books] = await libDb.execute(SQL.allBooks);
  const [authors] = await libDb.execute(SQL.allAuthors);
  res.status(opts.status || 200).render('books', {
    userName: req.session.userName,
    books,
    authors,
    errors: opts.errors || {},
    old: opts.old || {}
  });
}

app.get('/books', requireLogin, handle(async (req, res) => {
  await showBooks(req, res);
}));

app.post('/books', requireLogin, handle(async (req, res) => {
  const title = checkText(req.body.title, 'Title', MAX.title);
  const price = checkPrice(req.body.price);
  const author = checkAuthorId(req.body.author_id);
  const error = title.error || price.error || author.error;
  if (error) {
    return showBooks(req, res, { status: 400, errors: { add: error }, old: req.body });
  }
  try {
    await libDb.execute(SQL.addBook, [title.value, price.value, author.value]);
  } catch (err) {
    // author does not exist
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return showBooks(req, res, { status: 400, errors: { add: 'Please choose an existing author' }, old: req.body });
    }
    throw err;
  }
  res.redirect('/books');
}));

app.get('/books/:id/edit', requireLogin, handle(async (req, res) => {
  const [rows] = await libDb.execute(SQL.oneBook, [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
  }
  const [authors] = await libDb.execute(SQL.allAuthors);
  res.render('book-edit', { userName: req.session.userName, book: rows[0], authors, error: '' });
}));

app.post('/books/:id/edit', requireLogin, handle(async (req, res) => {
  const title = checkText(req.body.title, 'Title', MAX.title);
  const price = checkPrice(req.body.price);
  const author = checkAuthorId(req.body.author_id);
  const [authors] = await libDb.execute(SQL.allAuthors);
  const typed = { book_id: req.params.id, title: req.body.title || '', price: req.body.price || '', author_id: req.body.author_id || '' };
  const error = title.error || price.error || author.error;
  if (error) {
    return res.status(400).render('book-edit', { userName: req.session.userName, book: typed, authors, error });
  }
  try {
    await libDb.execute(SQL.editBook, [title.value, price.value, author.value, req.params.id]);
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).render('book-edit', { userName: req.session.userName, book: typed, authors, error: 'Please choose an existing author' });
    }
    throw err;
  }
  res.redirect('/books');
}));

app.post('/books/:id/delete', requireLogin, handle(async (req, res) => {
  await libDb.execute(SQL.deleteBook, [req.params.id]);
  res.redirect('/books');
}));

// must stay last
app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again later.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});