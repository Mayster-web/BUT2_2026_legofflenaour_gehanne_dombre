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

app.get('/louer/:id', exigerConnexion, (req, res) => {
    const produit = db.prepare('SELECT * FROM produit WHERE id = ?').get(req.params.id);
    if (!produit) {
        return res.status(404).render('erreur404');
    }
    res.render('louer', { produit });
});

app.post('/louer/:id', exigerConnexion, (req, res) => {
    const produit = db.prepare('SELECT * FROM produit WHERE id = ?').get(req.params.id);
    if (!produit) return res.status(404).render('erreur404');

    // Récupère les dates envoyées par le formulaire.
    const { date_debut, date_retour_prevue } = req.body;
    // Convertit les dates en nombres pour pouvoir les comparer et calculer la durée.
    const debut = Date.parse(date_debut);
    const fin = Date.parse(date_retour_prevue);

    // Vérifie que les deux dates sont valides et que la fin vient après le début.
    if (isNaN(debut) || isNaN(fin) || fin <= debut) {
        return res.status(400).send('Les dates de réservation sont invalides.');
    }

    // Calcule la durée de la réservation en jours (86 400 000 ms = 1 jour).
    const jours = (fin - debut) / 86_400_000;
    // Applique 10 % de réduction pour les locations d'au moins 7 jours.
    const reduction = jours >= 7 ? 0.9 : 1;
    // Calcule le prix côté serveur à partir du tarif enregistré en base.
    const prixTotal = jours * produit.prix_location * reduction;

    db.prepare(`
        INSERT INTO location (date_debut, date_retour_prevue, prix_total, utilisateur_id, produit_id)
        VALUES (?, ?, ?, ?, ?)
    `).run(date_debut, date_retour_prevue, prixTotal, req.session.userId, produit.id);

    res.redirect('/');
});

app.get('/location', exigerConnexion, (req, res) => {
    const produit = db.prepare(`
        SELECT produit.*, location.id AS location_id,
               location.date_debut, location.date_retour_prevue, location.prix_total
        FROM produit
        JOIN location ON produit.id = location.produit_id
        WHERE location.utilisateur_id = ?
    `).all(req.session.userId);
    res.render('location', { produit });
});

app.post('/location/:id/annuler', exigerConnexion, (req, res) => {
    // Supprime uniquement la réservation appartenant à l'utilisateur connecté.
    db.prepare('DELETE FROM location WHERE id = ? AND utilisateur_id = ?')
        .run(req.params.id, req.session.userId);

    res.redirect('/location');
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
