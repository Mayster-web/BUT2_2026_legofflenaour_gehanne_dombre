import express from 'express';
import { createHash } from 'node:crypto';
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
    const utilisateur = req.session.userId
        ? db.prepare('SELECT type_utilisateur FROM utilisateur WHERE id = ?').get(req.session.userId)
        : null;
    res.locals.isAgent = utilisateur && utilisateur.type_utilisateur === 'agent';
    res.locals.isAdmin = utilisateur && utilisateur.type_utilisateur === 'admin';
    next();
});

// ==================================================
// MIDDLESWARES
// ==================================================


function exigerConnexion(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

function exigerAgent(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    if (!res.locals.isAgent) {
        return res.sendStatus(403);
    }
    next();
}

function exigerAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    if (!res.locals.isAdmin) {
        return res.sendStatus(403);
    }
    next();
}


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

app.get('/admin', exigerAdmin, (req, res) => {
    const agents = db.prepare(`
        SELECT id, login, nom, prenom, email
        FROM utilisateur
        WHERE type_utilisateur = 'agent'
        ORDER BY id
    `).all();
    res.render('admin', { agents, erreur: null });
});

app.post('/admin/agents', exigerAdmin, (req, res) => {
    const { login, password, nom, prenom, ddn, email } = req.body;

    if (!login || !password || !nom || !prenom || !ddn || !email) {
        const agents = db.prepare("SELECT id, login, nom, prenom, email FROM utilisateur WHERE type_utilisateur = 'agent' ORDER BY id").all();
        return res.status(400).render('admin', {
            agents,
            erreur: 'Veuillez remplir tous les champs.'
        });
    }

    const compteExiste = db.prepare('SELECT id FROM utilisateur WHERE login = ? OR email = ?').get(login, email);
    if (compteExiste) {
        const agents = db.prepare("SELECT id, login, nom, prenom, email FROM utilisateur WHERE type_utilisateur = 'agent' ORDER BY id").all();
        return res.status(400).render('admin', {
            agents,
            erreur: 'Cet identifiant ou cette adresse e-mail est déjà utilisé.'
        });
    }

    const motDePasseHash = createHash('sha256').update(password).digest('hex');
    db.prepare(`
        INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(login, motDePasseHash, nom, prenom, ddn, email, 'agent');

    res.redirect('/admin');
});

app.post('/admin/agents/:id/supprimer', exigerAdmin, (req, res) => {
    const agent = db.prepare("SELECT id FROM utilisateur WHERE id = ? AND type_utilisateur = 'agent'").get(req.params.id);
    if (!agent) return res.status(404).render('erreur404');

    const location = db.prepare('SELECT id FROM location WHERE utilisateur_id = ?').get(agent.id);
    if (location) {
        const agents = db.prepare("SELECT id, login, nom, prenom, email FROM utilisateur WHERE type_utilisateur = 'agent' ORDER BY id").all();
        return res.status(400).render('admin', {
            agents,
            erreur: 'Cet agent a des locations associées et ne peut pas être supprimé.'
        });
    }

    db.prepare("DELETE FROM utilisateur WHERE id = ? AND type_utilisateur = 'agent'").run(agent.id);
    res.redirect('/admin');
});

app.get('/agent', exigerAgent, (req, res) => {
    const produits = db.prepare('SELECT * FROM produit ORDER BY id').all();
    res.render('agent', { produits, erreur: null });
});

app.post('/agent/produits', exigerAgent, (req, res) => {
    const { type, image, description, marque, modele, prix_location, etat } = req.body;

    if (!type || !marque || !modele || !prix_location || isNaN(prix_location) ||
        prix_location < 0 || !etat) {
        const produits = db.prepare('SELECT * FROM produit ORDER BY id').all();
        return res.status(400).render('agent', {
            produits,
            erreur: 'Veuillez remplir les champs obligatoires avec un prix valide.'
        });
    }

    db.prepare(`
        INSERT INTO produit (type, image, description, marque, modele, prix_location, etat)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(type, image || null, description || null, marque, modele, prix_location, etat);

    res.redirect('/agent');
});

app.post('/agent/produits/:id/supprimer', exigerAgent, (req, res) => {
    const location = db.prepare('SELECT * FROM location WHERE produit_id = ?').get(req.params.id);

    if (location) {
        const produits = db.prepare('SELECT * FROM produit ORDER BY id').all();
        return res.status(400).render('agent', {
            produits,
            erreur: 'Ce produit ne peut pas être supprimé car il possède des locations.'
        });
    }

    db.prepare('DELETE FROM produit WHERE id = ?').run(req.params.id);
    res.redirect('/agent');
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

app.use((req, res) => {
    res.status(404).render('erreur404');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
