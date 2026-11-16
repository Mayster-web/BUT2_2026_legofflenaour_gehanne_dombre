import express from 'express';
import { basename } from 'node:path';
import db from './bdd/dblite.js';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: "LescargotMangeLabretelleDautoroute", // Dans un véritable environnement de production, le secret ne serait pas écrit ici
    resave: false,
    saveUninitialized: false
}));

app.get('/', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id LIMIT 5').all();
    console.log(produit)
    res.render('index', { produit });
});

app.get('/catalogue', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id').all();
    console.log(produit)
    res.render('catalogue', { produit });
});

app.get('/contact', (req, res) => {
    res.render('contact');
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