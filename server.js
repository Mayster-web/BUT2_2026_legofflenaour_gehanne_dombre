import express from 'express';
import { basename } from 'node:path';
import db from './bdd/dblite.js';
import session from 'express-session';
import authRoutes from './routes/auth.js';

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

app.use((req, res, next) => {
    res.locals.isLoggedIn = Boolean(req.session.userId);
    next();
});

// ==================================================
// MIDDLEWARES
// ==================================================


function exigerConnexion(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};


// ==================================================
// ROUTES
// ==================================================


app.use(authRoutes);

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.sendStatus(500);
        res.redirect('/');
    });
});

app.get('/', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id LIMIT 5').all();
    console.log(produit);
    res.render('index', { produit });
});

app.get('/login', (req, res) => {
    res.render('login', { error: '' });
});

app.get('/inscription', (req, res) => {
    res.render('inscription');
});

app.get('/catalogue', (req, res) => {
    const produit = db.prepare('SELECT * FROM produit ORDER BY id').all();
    res.render('catalogue', { produit });
});

app.get('/louer/:id', (req, res) => {
    const id = req.params.id;
    const produit = db.prepare('SELECT * FROM produit WHERE id = ?').get(id);
    res.render('louer', { produit });
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

// Page détail produit
app.get('/detail/:id', (req, res) => {
    const id = req.params.id;
    const produit = db.prepare('SELECT * FROM produit WHERE id = ?').get(id);
    res.render('detail', { produit })
});

app.get('/supprimer:id', (req, res) => {
    const produit = db.prepare('DELETE * FROM produit WHERE id = ?').all();
    console.log(produit);
    res.render('index', { produit });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.sendStatus(500);
        res.redirect('/login');
    })
});

app.use((req, res) => {
    res.status(404).render('erreur404');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});