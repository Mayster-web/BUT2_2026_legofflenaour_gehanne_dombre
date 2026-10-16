import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dbPath = join(dirname(fileURLToPath(import.meta.url)), "bdd_sae301.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");

export default db;

// Pour tester si ca marche sur votre machine, ajoutez la ligne suivante au début de votre fichier server, dans les imports :
// import db from "./dblite.js";
// Ensuite dans une route, vous pouvez faire des requête pour récupérer les utilisateurs, par exemple :
// const result = db.prepare("SELECT * FROM utilisateur").all();
// Enfin un console.log(result) pour vérifier le résultat de la requête => Cela renvoie un tableau d'objets !!!
// et si il n'y a pas d'utilisateurs, le tableau sera vide, mais ce sera un tableau quand même !