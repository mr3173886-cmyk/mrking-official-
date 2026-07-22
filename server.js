const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'mrking-secret-key',
  resave: false,
  saveUninitialized: true
}));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mrking';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Database Schemas
const ScriptSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Script = mongoose.model('Script', ScriptSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' }
});
const User = mongoose.model('User', UserSchema);

// Static View Route
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

// Auth Routes
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user && user.status === 'active') {
    req.session.user = user;
    return res.redirect('/');
  }
  res.send('Invalid Credentials or Account Deactivated! <a href="/login">Try Again</a>');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API Routes
app.get('/api/data', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const scripts = await Script.find({}, 'name createdAt');
  const users = await User.find({}, 'username role status');
  res.json({ currentUser: req.session.user, scripts, users });
});

// Get Single Script Code (For Edit Modal)
app.get('/api/scripts/get/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const script = await Script.findById(req.params.id);
  res.json(script);
});

// Save or Create Script (Database Storage)
app.post('/api/scripts/save', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Unauthorized');
  const { id, name, code } = req.body;
  
  if (id) {
    // Update existing script
    await Script.findByIdAndUpdate(id, { name, code });
  } else {
    // Create new script
    await Script.create({ name, code });
  }
  res.redirect('/');
});

// Delete Script
app.post('/api/scripts/delete', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Unauthorized');
  await Script.findByIdAndDelete(req.body.id);
  res.redirect('/');
});

// Dynamic App Execution Engine (Runs code from MongoDB directly!)
app.get('/app/:name', async (req, res) => {
  try {
    const script = await Script.findOne({ name: req.params.name });
    if (!script) return res.status(404).send('App Not Found!');

    // Execute code dynamic scope
    const module = { exports: {} };
    const runCode = new Function('module', 'exports', 'require', 'console', script.code);
    runCode(module, module.exports, require, console);

    if (typeof module.exports === 'function') {
      module.exports(req, res);
    } else {
      res.send('Invalid Module Format');
    }
  } catch (err) {
    res.status(500).send('Error executing app: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
