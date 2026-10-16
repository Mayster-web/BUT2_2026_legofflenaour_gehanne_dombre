import express from 'express';

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/catalogue', (req, res) => {
    res.render('catalogue');
});

app.use((req, res) => {
    res.status(404).sendFile("./erreur404.ejs", { root: import.meta.dirname });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});