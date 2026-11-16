import express from 'express';
import { basename } from 'node:path';
import db from './bdd/dblite.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

app.get('/', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id LIMIT 5').all();
    console.log(produit)
    res.render('index', { produit });
});

app.get('/catalogue', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id').all();
    res.render('catalogue', { produit });
});

// Page détaille produit
app.get('/:id', (req, res) => {
    const id = req.params.id;
    const produit = db.prepare('SELECT * FROM produit WHERE id = ?').get(id);
    res.render('detaille', { produit })
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/inscription', (req, res) => {
    res.render('inscription');
});

app.use((req, res) => {
    res.status(404).render('erreur404');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});