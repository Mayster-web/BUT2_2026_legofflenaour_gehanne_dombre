import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import db from '../bdd/dblite.js';

const router = Router();

router.post('/inscription', (req, res) => {
    const { login, nom, prenom, ddn, email, password, 'password-confirm': passwordConfirm } = req.body;
    const profile = {
        login: typeof login === 'string' ? login.trim() : '',
        nom: typeof nom === 'string' ? nom.trim() : '',
        prenom: typeof prenom === 'string' ? prenom.trim() : '',
        ddn: typeof ddn === 'string' ? ddn : '',
        email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    };

    const renderError = (message, status = 400) => (
        res.status(status).render('inscription', { error: message })
    );

    if (Object.values(profile).some((value) => !value)
        || typeof password !== 'string'
        || password.length < 8
        || password !== passwordConfirm) {
        return renderError('Vérifiez les champs et assurez-vous que les mots de passe correspondent (8 caractères minimum).');
    }

    const birthDate = new Date(`${profile.ddn}T00:00:00Z`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
        || !/^\d{4}-\d{2}-\d{2}$/.test(profile.ddn)
        || Number.isNaN(birthDate.getTime())
        || birthDate.toISOString().slice(0, 10) !== profile.ddn
        || birthDate > new Date()) {
        return renderError('Veuillez saisir une adresse e-mail et une date de naissance valides.');
    }

    const existingUser = db.prepare(
        'SELECT login, email FROM utilisateur WHERE login = ? OR email = ?',
    ).get(profile.login, profile.email);

    if (existingUser) {
        return renderError(
            existingUser.login === profile.login
                ? 'Ce nom d’utilisateur est déjà utilisé.'
                : 'Cette adresse e-mail est déjà utilisée.',
            409,
        );
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = `$scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;

    try {
        db.prepare(`
            INSERT INTO utilisateur (login, password, nom, prenom, ddn, email, type_utilisateur)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            profile.login,
            passwordHash,
            profile.nom,
            profile.prenom,
            profile.ddn,
            profile.email,
            'client',
        );
    } catch (error) {
        if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE' || error.errcode === 2067) {
            return renderError('Ce nom d’utilisateur ou cette adresse e-mail est déjà utilisé.', 409);
        }
        throw error;
    }

    res.render('inscription', {
        success: 'Votre compte a été créé. Vous pouvez maintenant vous connecter.',
    });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).render('login', { error: 'Veuillez saisir votre e-mail et votre mot de passe.' });
    }

    const user = db.prepare(
        'SELECT id, password FROM utilisateur WHERE email = ?',
    ).get(email.trim().toLowerCase());
    const storedHash = user?.password ?? '';
    const scryptMatch = storedHash.match(/^\$scrypt\$([a-f\d]{32})\$([a-f\d]{128})$/i);
    const legacyAlgorithm = storedHash.length === 32
        ? 'md5'
        : storedHash.length === 64 ? 'sha256' : null;
    const expectedHash = scryptMatch
        ? scryptSync(password, scryptMatch[1], 64)
        : legacyAlgorithm ? createHash(legacyAlgorithm).update(password).digest() : null;
    const storedPassword = Buffer.from(scryptMatch ? scryptMatch[2] : storedHash, 'hex');
    const passwordMatches = expectedHash !== null
        && storedPassword.length === expectedHash.length
        && timingSafeEqual(storedPassword, expectedHash);

    if (!user || !passwordMatches) {
        return res.status(401).render('login', { error: 'Identifiants incorrects.' });
    }

    if (!scryptMatch) {
        const salt = randomBytes(16).toString('hex');
        const upgradedHash = `$scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
        db.prepare('UPDATE utilisateur SET password = ? WHERE id = ?').run(upgradedHash, user.id);
    }

    req.session.regenerate((error) => {
        if (error) {
            return res.sendStatus(500);
        }

        req.session.userId = user.id;
        res.redirect('/');
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.sendStatus(500);
        }
        res.redirect('/login');
    });
});

export default router;
