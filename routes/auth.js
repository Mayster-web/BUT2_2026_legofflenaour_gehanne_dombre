import { createHash } from 'node:crypto';
import { Router } from 'express';
import db from '../bdd/dblite.js';

const router = Router();

router.post('/login', (req, res) => {
    let username = req.body.username // Si vous utilisez un champ "name" dans le formulaire
    let email = req.body.email // Si vous utilisez un champ "name" dans le formulaire
    let mdp = req.body.password // Si vous utilisez un champ "password" dans le formulaire;
    let hashedPassword = createHash('sha256').update(mdp).digest('hex');

    // Rechercher l'utilisateur dans la base
    // get(username) sert à "remplacer" le "?" dans la requête SQL par la valeur de username
    const result = db.prepare("SELECT * FROM utilisateur WHERE email = ?").get(email);

    // Vérifier que l'utilisateur existe et que le mot de passe correspond
    if (result != null) {
        if (result.password === hashedPassword) {
            req.session.regenerate((err) => {
                if (err) {
                    return res.sendStatus(500);
                }
                req.session.userId = result.id; // Stocker l'identifiant de l'utilisateur dans la session
                res.redirect('/'); // Rediriger vers la page privée
            });
        } else {
            // Mot de passe incorrect
            res.render('login', { error: 'Identifiants incorrects' });
        }
    }
    else {
        // Utilisateur non trouvé
        res.render('login', { error: 'Identifiants incorrects' });
    }
});

export default router;