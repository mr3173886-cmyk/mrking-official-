const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Database Connection
const MONGO_URI = "mongodb+srv://mr3173886_db_user:mN4QXSyfon3Q6F0M@cluster0.wxusz0z.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err.message));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'mr_king_aura_secret',
  resave: false,
  saveUninitialized: true
}));

// Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['active', 'deactive'], default: 'active' }
});

const ScriptSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  slug: String,
  uploadedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Script = mongoose.model('Script', ScriptSchema);

// Setup Dynamic Modules Directory
const dynamicDir = path.join(__dirname, 'dynamic_modules');
if (!fs.existsSync(dynamicDir)) fs.mkdirSync(dynamicDir, { recursive: true });

// Multer Config (Supports any file/extension)
const storage = multer.diskStorage({
  destination: dynamicDir,
  filename: (req, file, cb) => {
    const rawName = file.originalname.replace(/\.[^/.]+$/, "");
    const safeSlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    cb(null, `${safeSlug}-${Date.now()}.js`);
  }
});
const upload = multer({ storage });

// Initialize Main Admin
async function initAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'mr.king' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('monikaomydarling123@#009', 10);
      await User.create({
        username: 'mr.king',
        password: hashedPassword,
        role: 'admin',
        status: 'active'
      });
      console.log('Main Admin Created Successfully!');
    }
  } catch (e) {
    console.error('Admin Init Error:', e.message);
  }
}

// Load All Dynamic Modules on Startup
async function loadDynamicScripts() {
  try {
    const scripts = await Script.find();
    scripts.forEach(s => {
      try {
        const modulePath = path.resolve(s.filepath);
        if (fs.existsSync(modulePath)) {
          delete require.cache[require.resolve(modulePath)];
          const dynamicRoute = require(modulePath);
          app.use(`/app/${s.slug}`, dynamicRoute);
        }
      } catch (err) {
        console.error(`Error loading script ${s.filename}:`, err.message);
      }
    });
  } catch (err) {
    console.error('Script Loading Failed:', err.message);
  }
}

// Auth Middlewares
function checkAuth(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/login');
}

function checkAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') next();
  else res.status(403).send('Access Denied: Admins Only');
}

// Base Routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));

// Login Handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  
  if (!user) return res.send('User not found!');
  if (user.status === 'deactive') return res.send('Your account is deactivated!');

  const isMatch = await bcrypt.compare(password, user.password);
  if (isMatch) {
    req.session.user = user;
    res.redirect('/');
  } else {
    res.send('Invalid password!');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// User Management APIs
app.post('/api/users/create', checkAuth, checkAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword, role: role || 'user' });
    res.redirect('/');
  } catch (e) {
    res.send('User creation failed (User might already exist).');
  }
});

app.post('/api/users/toggle-status', checkAuth, checkAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.body.userId, { status: req.body.status });
  res.redirect('/');
});

app.post('/api/users/delete', checkAuth, checkAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.body.userId);
  res.redirect('/');
});

// 1. Direct Code Paste Creator API
app.post('/api/scripts/create-code', checkAuth, checkAdmin, async (req, res) => {
  const { scriptName, codeContent } = req.body;
  if (!scriptName || !codeContent) return res.send('Script name and code are required!');

  const slug = scriptName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
  const filePath = path.join(dynamicDir, `${slug}.js`);

  fs.writeFileSync(filePath, codeContent);

  const newScript = await Script.create({
    filename: `${scriptName}.js`,
    filepath: filePath,
    slug: slug
  });

  try {
    delete require.cache[require.resolve(filePath)];
    const dynamicRoute = require(filePath);
    app.use(`/app/${newScript.slug}`, dynamicRoute);
  } catch (e) {
    console.error('Mount Error:', e.message);
  }

  res.redirect('/');
});

// 2. File Upload Handler API
app.post('/api/scripts/upload', checkAuth, checkAdmin, upload.single('scriptFile'), async (req, res) => {
  if (req.file) {
    const rawName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);

    const newScript = await Script.create({
      filename: `${rawName}.js`,
      filepath: req.file.path,
      slug: slug
    });

    try {
      const modulePath = path.resolve(newScript.filepath);
      delete require.cache[require.resolve(modulePath)];
      const dynamicRoute = require(modulePath);
      app.use(`/app/${newScript.slug}`, dynamicRoute);
    } catch (e) {
      console.error('Upload Mount Error:', e.message);
    }
  }
  res.redirect('/');
});

// Fetch Application Data
app.get('/api/data', checkAuth, async (req, res) => {
  const scripts = await Script.find();
  const users = req.session.user.role === 'admin' ? await User.find() : [];
  res.json({
    currentUser: req.session.user,
    scripts,
    users
  });
});

// Start Server
mongoose.connect(MONGO_URI).then(async () => {
  await initAdmin();
  await loadDynamicScripts();
  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
});

