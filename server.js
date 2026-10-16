import express from 'express';
import { basename } from 'node:path';
import db from './bdd/dblite.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/catalogue', (req, res) => {
    const produits = db.prepare('SELECT * FROM produit ORDER BY id').all().map(produit => ({
        ...produit,
        imageUrl: produit.image ? `/img/${basename(produit.image)}` : '/img/placeholder.png'
    }));
    res.render('catalogue', { produits });
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