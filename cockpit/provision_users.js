import process from "node:process";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const required = [
  "COCKPIT_ADMIN_EMAIL",
  "COCKPIT_ADMIN_PASSWORD",
  "COCKPIT_DIRECTOR_EMAIL",
  "COCKPIT_DIRECTOR_PASSWORD"
];
for (const key of required) {
  if (!process.env[key]) throw new Error(key + " est requis.");
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const people = [
  {
    email: process.env.COCKPIT_ADMIN_EMAIL.trim().toLowerCase(),
    password: process.env.COCKPIT_ADMIN_PASSWORD,
    displayLabel: "Valentin Wittwe",
    role: "admin"
  },
  {
    email: process.env.COCKPIT_DIRECTOR_EMAIL.trim().toLowerCase(),
    password: process.env.COCKPIT_DIRECTOR_PASSWORD,
    displayLabel: "Annie Goyer",
    role: "director"
  }
];
for (const person of people) {
  if (person.password.length < 16) throw new Error("Chaque mot de passe doit comporter au moins 16 caractères.");
  if (!/^\S+@\S+\.\S+$/.test(person.email)) throw new Error("Adresse courriel invalide.");
}

const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const auth = getAuth(app);
const db = getFirestore(app);
const results = [];

for (const person of people) {
  let user;
  let created = false;
  try {
    user = await auth.getUserByEmail(person.email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email: person.email,
      password: person.password,
      displayName: person.displayLabel,
      disabled: false
    });
    created = true;
  }
  await db.collection("users").doc(user.uid).set({
    role: person.role,
    displayLabel: person.displayLabel,
    active: true,
    provisionedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  results.push({ role: person.role, uid: user.uid, created });
}

console.log(JSON.stringify({ provisioned: results }, null, 2));
