const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

require('dotenv').config();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const DATA_FILE = path.join(__dirname, 'data.json');
const VCF_FILE = path.join(__dirname, 'contacts.vcf');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many submissions, please try again later.'
});
app.use('/submit', limiter);

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { contacts: [], downloadEnabled: true, downloadCount: 0 };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function formatPhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\s/g, '').replace(/[()]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+233' + cleaned.slice(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

function generateVCF(contacts) {
  const seen = new Set();
  const uniqueContacts = contacts.filter(c => {
    const key = `${c.name}-${c.phone}`;
    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });

  let vcf = '';
  uniqueContacts.forEach(c => {
    vcf += `BEGIN:VCARD
VERSION:4.0
FN:${c.name}
TEL;TYPE=CELL:${formatPhone(c.phone)}
END:VCARD
`;
  });
  fs.writeFileSync(VCF_FILE, vcf || '');
  return uniqueContacts.length;
}

function ensureVCF() {
  const data = loadData();
  generateVCF(data.contacts);
}

ensureVCF();

app.get('/', (req, res) => {
  const data = loadData();
  res.render('index', {
    success: req.query.success,
    downloadEnabled: data.downloadEnabled,
    contacts: data.contacts
  });
});

app.post('/submit', (req, res) => {
  const name = req.body.name?.trim();
  const phone = req.body.phone?.trim();

  if (!name || name.length < 2) {
    return res.status(400).send('Name is required and must be at least 2 characters');
  }

  if (phone && !/^[\d\s\+\-\(\)]+$/.test(phone)) {
    return res.status(400).send('Invalid phone number format');
  }

  const data = loadData();
  data.contacts.push({ name, phone });
  saveData(data);
  generateVCF(data.contacts);
  res.redirect('/?success=1');
});

app.get('/download.vcf', (req, res) => {
  const data = loadData();
  if (!data.downloadEnabled) return res.status(403).send('Download disabled');
  data.downloadCount = (data.downloadCount || 0) + 1;
  saveData(data);
  res.download(VCF_FILE);
});

app.get('/admin', (req, res) => {
  const data = loadData();
  const password = req.query.password || '';
  const loggedIn = req.query.password === ADMIN_PASSWORD;

  if (!loggedIn && !password) {
    return res.render('login');
  }

  if (!loggedIn) {
    return res.status(403).send('Access denied');
  }

  res.render('admin', {
    password: password,
    downloadEnabled: data.downloadEnabled,
    contacts: data.contacts,
    downloadCount: data.downloadCount || 0
  });
});

app.get('/admin/disable', (req, res) => {
  const password = req.query.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  const data = loadData();
  data.downloadEnabled = false;
  saveData(data);
  res.redirect('/admin?password=' + encodeURIComponent(password));
});

app.get('/admin/enable', (req, res) => {
  const password = req.query.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  const data = loadData();
  data.downloadEnabled = true;
  saveData(data);
  res.redirect('/admin?password=' + encodeURIComponent(password));
});

app.post('/admin/reset', (req, res) => {
  const password = req.body.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify({ contacts: [], downloadEnabled: false, downloadCount: 0 }, null, 2));
  if (fs.existsSync(VCF_FILE)) fs.unlinkSync(VCF_FILE);
  res.redirect('/admin?password=' + encodeURIComponent(password));
});

app.post('/admin/delete/:index', (req, res) => {
  const password = req.body.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  const data = loadData();
  const index = parseInt(req.params.index);
  if (index >= 0 && index < data.contacts.length) {
    data.contacts.splice(index, 1);
    saveData(data);
    generateVCF(data.contacts);
  }
  res.redirect('/admin?password=' + encodeURIComponent(password));
});

app.get('/admin/edit/:index', (req, res) => {
  const password = req.query.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  const index = parseInt(req.params.index);
  const data = loadData();
  if (index < 0 || index >= data.contacts.length) {
    return res.status(404).send('Contact not found');
  }
  res.render('edit', {
    password: password,
    contact: data.contacts[index],
    index: index
  });
});

app.post('/admin/update/:index', (req, res) => {
  const password = req.body.password || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).send('Access denied');
  }
  const name = req.body.name?.trim();
  const phone = req.body.phone?.trim();
  const index = parseInt(req.params.index);
  
  if (!name || name.length < 2) {
    return res.status(400).send('Name is required and must be at least 2 characters');
  }
  
  if (phone && !/^[\d\s\+\-\(\)]+$/.test(phone)) {
    return res.status(400).send('Invalid phone number format');
  }
  
  const data = loadData();
  if (index >= 0 && index < data.contacts.length) {
    data.contacts[index] = { name, phone };
    saveData(data);
    generateVCF(data.contacts);
  }
  res.redirect('/admin?password=' + encodeURIComponent(password));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));