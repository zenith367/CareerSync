const express = require("express");
const router = express.Router();
const admin = require("../config/firebaseAdmin");
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

/**
 * Approve a registration (institution or company)
 * Creates Firebase Auth user ONLY if email does not already exist.
 * Sends password to email.
 */
router.post("/approve-registration", async (req, res) => {
  try {
    const { registrationId, email, name, role } = req.body;

    if (!registrationId || !email || !name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Approval request:", req.body);

    let uid = null;

    // Step 1 → Check if email already exists in Firebase Auth
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
      console.log("User already exists → Using existing UID:", uid);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Step 2 → Create new user with generated password
        const generatedPassword = Math.random().toString(36).slice(-8);

        const newUser = await admin.auth().createUser({
          email,
          password: generatedPassword,
          emailVerified: false,
        });

        uid = newUser.uid;

        // send password via email
        await sendPasswordEmail(email, generatedPassword);
        console.log("New user created and email sent.");

      } else {
        console.error("Email lookup error:", err);
        return res.status(500).json({ error: "Email check failed" });
      }
    }

    if (!uid) {
      return res.status(500).json({ error: "No UID generated" });
    }

    // Step 3 → Move data from registrations → users + role collection
    const regRef = db.collection("registrations").doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const regData = regSnap.data();

    // Add to users collection
    await db.collection("users").doc(uid).set({
      uid,
      email,
      name,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...regData
    });

    // Add to specific role collection
    await db.collection(role).doc(uid).set({
      uid,
      email,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...regData
    });

    // Step 4 → Delete registration
    await regRef.delete();

    return res.status(200).json({ success: true, uid });

  } catch (error) {
    console.error("Approval error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Dummy email sender – Replace with real email service
 */
async function sendPasswordEmail(email, password) {
  console.log(`Email sent to ${email}: password = ${password}`);
  return true;
}

module.exports = router;
