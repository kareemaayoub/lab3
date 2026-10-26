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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again later.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});